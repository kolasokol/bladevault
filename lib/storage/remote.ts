import path from 'path';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Knife, KnifeUpdates } from '@/lib/data';
import { AppSettings, buildR2Endpoint } from '@/lib/settings';
import { CreateKnifeInput, ImageData, Storage } from './types';
import { generateId, getNextImageIndex } from './local';

function extensionFromMimeType(contentType: string): string {
  const type = contentType.split(';')[0].trim().toLowerCase();
  const map: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
  };
  return map[type] ?? 'jpg';
}

function extensionFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).toLowerCase().replace('.', '');
    if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'svg'].includes(ext)) {
      return ext === 'jpeg' ? 'jpg' : ext;
    }
  } catch {
    // ignore
  }
  return '';
}

function extensionFromDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:image\/([a-z0-9+]+);base64,/i);
  if (!match) return 'jpg';
  const subtype = match[1].toLowerCase();
  if (subtype === 'jpeg' || subtype === 'jpg') return 'jpg';
  if (['png', 'webp', 'gif', 'avif', 'svg'].includes(subtype)) return subtype;
  return 'jpg';
}

function getContentType(ext: string): string {
  const map: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    gif: 'image/gif',
    avif: 'image/avif',
    svg: 'image/svg+xml',
  };
  return map[ext] ?? 'application/octet-stream';
}

export function rowToKnife(row: Record<string, unknown>): Knife {
  return {
    id: String(row.id),
    name: String(row.name),
    brand: String(row.brand),
    bladeStyle: String(row.blade_style),
    handleMaterial: String(row.handle_material),
    images: (JSON.parse(String(row.images)) as string[] | null) ?? [],
    specs: (JSON.parse(String(row.specs)) as Knife['specs'] | null) ?? {} as Knife['specs'],
    description: String(row.description),
    addedAt: String(row.added_at),
    sourceUrl: String(row.source_url ?? ''),
    pinned: Boolean(row.pinned),
  };
}

type D1QueryResult<T = unknown> = {
  success: boolean;
  results?: T[];
  meta?: Record<string, unknown>;
};

export class RemoteStorage implements Storage {
  private settings: AppSettings;
  private s3: S3Client;

  constructor(settings: AppSettings) {
    this.settings = settings;
    this.s3 = new S3Client({
      region: 'auto',
      endpoint: settings.r2Endpoint || buildR2Endpoint(settings.cloudflareAccountId),
      credentials: {
        accessKeyId: settings.r2AccessKeyId,
        secretAccessKey: settings.r2SecretAccessKey,
      },
    });
  }

  private async queryD1<T = unknown>(sql: string, params?: string[]): Promise<D1QueryResult<T>> {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.settings.cloudflareAccountId}/d1/database/${this.settings.d1DatabaseId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.settings.cloudflareApiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sql, params }),
      }
    );

    const data = (await response.json()) as {
      success?: boolean;
      errors?: Array<{ message: string }>;
      result?: D1QueryResult<T>[];
    };

    if (!response.ok || !data.success) {
      const message = data.errors?.[0]?.message || `HTTP ${response.status}`;
      throw new Error(`D1 query failed: ${message}`);
    }

    const first = data.result?.[0];
    if (!first) {
      throw new Error('D1 query returned no result');
    }

    return first;
  }

  async init(): Promise<void> {
    await this.queryD1(`
      CREATE TABLE IF NOT EXISTS knives (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        brand TEXT NOT NULL,
        steel TEXT NOT NULL DEFAULT '',
        blade_style TEXT NOT NULL,
        handle_material TEXT NOT NULL,
        images TEXT NOT NULL,
        specs TEXT NOT NULL,
        description TEXT NOT NULL,
        added_at TEXT NOT NULL,
        source_url TEXT NOT NULL DEFAULT '',
        pinned INTEGER NOT NULL DEFAULT 0
      );
    `);
    await this.queryD1(`
      CREATE TABLE IF NOT EXISTS compare_list (
        knife_id TEXT PRIMARY KEY,
        added_at TEXT NOT NULL
      );
    `);
  }

  async getAllKnives(): Promise<Knife[]> {
    const result = await this.queryD1<Record<string, unknown>>(
      'SELECT * FROM knives ORDER BY added_at DESC'
    );
    return (result.results ?? []).map((row) => rowToKnife(row));
  }

  async getKnifeById(id: string): Promise<Knife | undefined> {
    const result = await this.queryD1<Record<string, unknown>>(
      'SELECT * FROM knives WHERE id = ?',
      [id]
    );
    const row = result.results?.[0];
    return row ? rowToKnife(row) : undefined;
  }

  private async ensureUniqueId(id: string): Promise<string> {
    const existing = await this.getKnifeById(id);
    if (!existing) return id;
    let counter = 2;
    while (await this.getKnifeById(`${id}-${counter}`)) {
      counter += 1;
    }
    return `${id}-${counter}`;
  }

  private async downloadImage(url: string, knifeId: string, index: number): Promise<string> {
    const response = await fetch(url, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: url,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    let ext = extensionFromUrl(url) || extensionFromMimeType(contentType);
    if (ext === 'svg' && contentType && !contentType.includes('svg')) {
      ext = extensionFromMimeType(contentType);
    }

    const filename = `image-${String(index + 1).padStart(2, '0')}.${ext}`;
    const key = `${knifeId}/${filename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.settings.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: getContentType(ext),
      })
    );

    const baseUrl = this.settings.r2BucketUrl.replace(/\/$/, '');
    return `${baseUrl}/${key}`;
  }

  private async uploadDataUrl(dataUrl: string, knifeId: string, index: number): Promise<string> {
    const match = dataUrl.match(/^data:image\/([a-z0-9+]+);base64,/i);
    if (!match) {
      throw new Error('Invalid image data URL');
    }

    const base64 = dataUrl.slice(match[0].length);
    const buffer = Buffer.from(base64, 'base64');
    const ext = extensionFromDataUrl(dataUrl);
    const contentType = getContentType(ext);

    const filename = `image-${String(index + 1).padStart(2, '0')}.${ext}`;
    const key = `${knifeId}/${filename}`;

    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.settings.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const baseUrl = this.settings.r2BucketUrl.replace(/\/$/, '');
    return `${baseUrl}/${key}`;
  }

  async createKnife(input: CreateKnifeInput): Promise<Knife> {
    const id = await this.ensureUniqueId(generateId(input.name));
    const addedAt = new Date().toISOString();

    const imageUrls: string[] = [];
    for (let i = 0; i < input.imageUrls.length; i++) {
      try {
        const src = input.imageUrls[i];
        let publicUrl: string;
        if (src.startsWith('data:image')) {
          publicUrl = await this.uploadDataUrl(src, id, i);
        } else {
          publicUrl = await this.downloadImage(src, id, i);
        }
        imageUrls.push(publicUrl);
      } catch {
        // Skip images that fail to download.
      }
    }

    const newKnife: Knife = {
      id,
      name: input.name,
      brand: input.brand,
      bladeStyle: input.bladeStyle,
      handleMaterial: input.handleMaterial,
      images: imageUrls,
      specs: input.specs,
      description: input.description,
      addedAt,
      sourceUrl: input.sourceUrl ?? '',
      pinned: input.pinned ?? false,
    };

    await this.queryD1(
      `INSERT INTO knives (id, name, brand, steel, blade_style, handle_material, images, specs, description, added_at, source_url, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newKnife.id,
        newKnife.name,
        newKnife.brand,
        '',
        newKnife.bladeStyle,
        newKnife.handleMaterial,
        JSON.stringify(newKnife.images),
        JSON.stringify(newKnife.specs),
        newKnife.description,
        newKnife.addedAt,
        newKnife.sourceUrl,
        String(newKnife.pinned ? 1 : 0),
      ]
    );

    return newKnife;
  }

  async updateKnife(id: string, updates: KnifeUpdates): Promise<Knife> {
    const existing = await this.getKnifeById(id);
    if (!existing) {
      throw new Error(`Knife with id "${id}" not found`);
    }

    const baseUrl = this.settings.r2BucketUrl.replace(/\/$/, '');
    const incomingImages = updates.images ?? existing.images;
    const existingExternalUrls = new Set(
      existing.images.filter((src) => src.startsWith('http://') || src.startsWith('https://'))
    );

    let nextIndex = getNextImageIndex(existing.images);
    const processedImages: string[] = [];

    for (const src of incomingImages) {
      if (src.startsWith('data:image')) {
        try {
          const publicUrl = await this.uploadDataUrl(src, id, nextIndex);
          processedImages.push(publicUrl);
          nextIndex += 1;
        } catch {
          // Skip images that fail to decode.
        }
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        if (src.startsWith(baseUrl) || existingExternalUrls.has(src)) {
          processedImages.push(src);
        } else {
          try {
            const publicUrl = await this.downloadImage(src, id, nextIndex);
            processedImages.push(publicUrl);
            nextIndex += 1;
          } catch {
            // Skip images that fail to download.
          }
        }
      } else {
        processedImages.push(src);
      }
    }

    for (const img of existing.images) {
      if (!processedImages.includes(img) && img.startsWith(baseUrl)) {
        const key = img.slice(baseUrl.length + 1);
        if (key) {
          try {
            await this.s3.send(
              new DeleteObjectCommand({
                Bucket: this.settings.r2BucketName,
                Key: key,
              })
            );
          } catch {
            // ignore cleanup errors
          }
        }
      }
    }

    const updated: Knife = {
      ...existing,
      name: updates.name ?? existing.name,
      brand: updates.brand ?? existing.brand,
      bladeStyle: updates.bladeStyle ?? existing.bladeStyle,
      handleMaterial: updates.handleMaterial ?? existing.handleMaterial,
      description: updates.description ?? existing.description,
      sourceUrl: updates.sourceUrl ?? existing.sourceUrl,
      images: processedImages,
      pinned: updates.pinned ?? existing.pinned,
      specs: {
        ...existing.specs,
        ...(updates.specs ?? {}),
      },
    };

    await this.queryD1(
      `UPDATE knives
       SET name = ?, brand = ?, steel = ?, blade_style = ?, handle_material = ?, images = ?, specs = ?, description = ?, source_url = ?, pinned = ?
       WHERE id = ?`,
      [
        updated.name,
        updated.brand,
        '',
        updated.bladeStyle,
        updated.handleMaterial,
        JSON.stringify(updated.images),
        JSON.stringify(updated.specs),
        updated.description,
        updated.sourceUrl,
        String(updated.pinned ? 1 : 0),
        id,
      ]
    );

    return updated;
  }

  async deleteKnife(id: string): Promise<void> {
    const knife = await this.getKnifeById(id);
    if (!knife) return;

    await this.queryD1('DELETE FROM knives WHERE id = ?', [id]);
    await this.queryD1('DELETE FROM compare_list WHERE knife_id = ?', [id]);

    const baseUrl = this.settings.r2BucketUrl.replace(/\/$/, '');

    for (const imageUrl of knife.images) {
      if (!imageUrl.startsWith(baseUrl)) continue;

      const key = imageUrl.slice(baseUrl.length + 1);
      if (!key) continue;

      try {
        await this.s3.send(
          new DeleteObjectCommand({
            Bucket: this.settings.r2BucketName,
            Key: key,
          })
        );
      } catch {
        // Ignore cleanup errors so deletion of the knife record still succeeds.
      }
    }
  }

  async getCompareList(): Promise<string[]> {
    const result = await this.queryD1<{ knife_id: string }>(
      'SELECT knife_id FROM compare_list ORDER BY added_at ASC'
    );
    return (result.results ?? []).map((r) => r.knife_id);
  }

  async addToCompare(id: string): Promise<void> {
    const addedAt = new Date().toISOString();
    await this.queryD1(
      'INSERT OR IGNORE INTO compare_list (knife_id, added_at) VALUES (?, ?)',
      [id, addedAt]
    );
  }

  async removeFromCompare(id: string): Promise<void> {
    await this.queryD1('DELETE FROM compare_list WHERE knife_id = ?', [id]);
  }

  async clearCompareList(): Promise<void> {
    await this.queryD1('DELETE FROM compare_list');
  }

  async migrateCompareList(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.addToCompare(id);
      } catch {
        // ignore
      }
    }
  }

  async getImage(publicUrl: string): Promise<ImageData> {
    const response = await fetch(publicUrl);
    if (!response.ok) {
      throw new Error(`Image not found: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const contentType = response.headers.get('content-type') ?? 'application/octet-stream';
    return { buffer, contentType };
  }

  async uploadImage(key: string, buffer: Buffer, contentType: string): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.settings.r2BucketName,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );

    const baseUrl = this.settings.r2BucketUrl.replace(/\/$/, '');
    return `${baseUrl}/${key}`;
  }

  async migrateKnife(knife: Knife, images: string[]): Promise<void> {
    await this.queryD1(
      `INSERT OR REPLACE INTO knives (id, name, brand, steel, blade_style, handle_material, images, specs, description, added_at, source_url, pinned)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        knife.id,
        knife.name,
        knife.brand,
        '',
        knife.bladeStyle,
        knife.handleMaterial,
        JSON.stringify(images),
        JSON.stringify(knife.specs),
        knife.description,
        knife.addedAt,
        knife.sourceUrl,
        String(knife.pinned ? 1 : 0),
      ]
    );
  }
}
