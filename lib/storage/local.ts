import fs from 'fs/promises';
import path from 'path';
import { Knife, KnifeUpdates } from '@/lib/data';
import { getLocalDb } from '@/lib/local-db';
import { CreateKnifeInput, ImageData, Storage } from './types';

export const IMAGES_DIR = 'data/images';

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

export function generateId(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 64) || `knife-${Date.now()}`
  );
}

export function getNextImageIndex(images: string[]): number {
  let maxIndex = -1;
  for (const image of images) {
    try {
      const pathname = image.startsWith('http://') || image.startsWith('https://')
        ? new URL(image).pathname
        : image;
      const filename = path.basename(pathname);
      const match = filename.match(/^image-(\d+)\./);
      if (match) {
        maxIndex = Math.max(maxIndex, parseInt(match[1], 10) - 1);
      }
    } catch {
      // ignore invalid paths/urls
    }
  }
  return maxIndex + 1;
}

function getDb() {
  return getLocalDb();
}

export class LocalStorage implements Storage {
  async getAllKnives(): Promise<Knife[]> {
    const rows = getDb().prepare('SELECT * FROM knives ORDER BY added_at DESC').all();
    return rows.map((row) => rowToKnife(row as Record<string, unknown>));
  }

  async getKnifeById(id: string): Promise<Knife | undefined> {
    const row = getDb().prepare('SELECT * FROM knives WHERE id = ?').get(id);
    return row ? rowToKnife(row as Record<string, unknown>) : undefined;
  }

  async ensureUniqueId(id: string): Promise<string> {
    const existing = await this.getKnifeById(id);
    if (!existing) return id;
    let counter = 2;
    while (await this.getKnifeById(`${id}-${counter}`)) {
      counter += 1;
    }
    return `${id}-${counter}`;
  }

  async downloadImage(url: string, knifeId: string, index: number): Promise<string> {
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

    const dir = path.join(IMAGES_DIR, knifeId);
    await fs.mkdir(dir, { recursive: true });

    const filename = `image-${String(index + 1).padStart(2, '0')}.${ext}`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);

    return `${knifeId}/${filename}`;
  }

  async saveDataUrl(dataUrl: string, knifeId: string, index: number): Promise<string> {
    const match = dataUrl.match(/^data:image\/([a-z0-9+]+);base64,/i);
    if (!match) {
      throw new Error('Invalid image data URL');
    }

    const base64 = dataUrl.slice(match[0].length);
    const buffer = Buffer.from(base64, 'base64');
    const ext = extensionFromDataUrl(dataUrl);

    const dir = path.join(IMAGES_DIR, knifeId);
    await fs.mkdir(dir, { recursive: true });

    const filename = `image-${String(index + 1).padStart(2, '0')}.${ext}`;
    const filePath = path.join(dir, filename);
    await fs.writeFile(filePath, buffer);

    return `${knifeId}/${filename}`;
  }

  async createKnife(input: CreateKnifeInput): Promise<Knife> {
    const id = await this.ensureUniqueId(generateId(input.name));
    const addedAt = new Date().toISOString();

    const imagePaths: string[] = [];
    for (let i = 0; i < input.imageUrls.length; i++) {
      try {
        const src = input.imageUrls[i];
        let relativePath: string;
        if (src.startsWith('data:image')) {
          relativePath = await this.saveDataUrl(src, id, i);
        } else {
          relativePath = await this.downloadImage(src, id, i);
        }
        imagePaths.push(relativePath);
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
      images: imagePaths,
      specs: input.specs,
      description: input.description,
      addedAt,
      sourceUrl: input.sourceUrl ?? '',
      pinned: input.pinned ?? false,
    };

    getDb()
      .prepare(
        `INSERT INTO knives (id, name, brand, steel, blade_style, handle_material, images, specs, description, added_at, source_url, pinned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        newKnife.pinned ? 1 : 0
      );

    return newKnife;
  }

  async updateKnife(id: string, updates: KnifeUpdates): Promise<Knife> {
    const existing = await this.getKnifeById(id);
    if (!existing) {
      throw new Error(`Knife with id "${id}" not found`);
    }

    const incomingImages = updates.images ?? existing.images;
    const existingExternalUrls = new Set(
      existing.images.filter((src) => src.startsWith('http://') || src.startsWith('https://'))
    );

    let nextIndex = getNextImageIndex(existing.images);
    const processedImages: string[] = [];

    for (const src of incomingImages) {
      if (src.startsWith('data:image')) {
        try {
          const relativePath = await this.saveDataUrl(src, id, nextIndex);
          processedImages.push(relativePath);
          nextIndex += 1;
        } catch {
          // Skip images that fail to decode.
        }
      } else if (src.startsWith('http://') || src.startsWith('https://')) {
        if (existingExternalUrls.has(src)) {
          processedImages.push(src);
        } else {
          try {
            const relativePath = await this.downloadImage(src, id, nextIndex);
            processedImages.push(relativePath);
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
      if (!processedImages.includes(img) && !img.startsWith('http://') && !img.startsWith('https://')) {
        try {
          const filePath = path.join(IMAGES_DIR, img);
          const resolved = path.resolve(filePath);
          const base = path.resolve(IMAGES_DIR);
          if (resolved.startsWith(base)) {
            await fs.unlink(resolved);
          }
        } catch {
          // ignore cleanup errors
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

    getDb()
      .prepare(
        `UPDATE knives
         SET name = ?, brand = ?, steel = ?, blade_style = ?, handle_material = ?, images = ?, specs = ?, description = ?, source_url = ?, pinned = ?
         WHERE id = ?`
      )
      .run(
        updated.name,
        updated.brand,
        '',
        updated.bladeStyle,
        updated.handleMaterial,
        JSON.stringify(updated.images),
        JSON.stringify(updated.specs),
        updated.description,
        updated.sourceUrl,
        updated.pinned ? 1 : 0,
        id
      );

    return updated;
  }

  async deleteKnife(id: string): Promise<void> {
    const knife = await this.getKnifeById(id);
    if (!knife) return;

    getDb().prepare('DELETE FROM knives WHERE id = ?').run(id);
    getDb().prepare('DELETE FROM compare_list WHERE knife_id = ?').run(id);

    try {
      const dir = path.join(IMAGES_DIR, id);
      await fs.rm(dir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }

  async getCompareList(): Promise<string[]> {
    const rows = getDb()
      .prepare('SELECT knife_id FROM compare_list ORDER BY added_at ASC')
      .all() as Array<{ knife_id: string }>;
    return rows.map((r) => r.knife_id);
  }

  async addToCompare(id: string): Promise<void> {
    const addedAt = new Date().toISOString();
    getDb()
      .prepare('INSERT OR IGNORE INTO compare_list (knife_id, added_at) VALUES (?, ?)')
      .run(id, addedAt);
  }

  async removeFromCompare(id: string): Promise<void> {
    getDb().prepare('DELETE FROM compare_list WHERE knife_id = ?').run(id);
  }

  async clearCompareList(): Promise<void> {
    getDb().prepare('DELETE FROM compare_list').run();
  }

  async migrateKnife(knife: Knife, images: string[]): Promise<void> {
    getDb()
      .prepare(
        `INSERT OR REPLACE INTO knives (id, name, brand, steel, blade_style, handle_material, images, specs, description, added_at, source_url, pinned)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
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
        knife.pinned ? 1 : 0
      );
  }

  async migrateCompareList(ids: string[]): Promise<void> {
    for (const id of ids) {
      try {
        await this.addToCompare(id);
      } catch {
        // ignore invalid compare ids during bulk restore
      }
    }
  }

  async replaceAllWithSnapshot(knives: Knife[], compareIds: string[]): Promise<void> {
    const current = await this.getAllKnives();

    for (const knife of current) {
      await this.deleteKnife(knife.id);
    }

    for (const knife of knives) {
      const importedImages: string[] = [];

      for (let index = 0; index < knife.images.length; index += 1) {
        const image = knife.images[index];

        if (image.startsWith('data:image')) {
          try {
            importedImages.push(await this.saveDataUrl(image, knife.id, index));
          } catch {
            // ignore broken embedded images during restore
          }
          continue;
        }

        if (image.startsWith('http://') || image.startsWith('https://')) {
          try {
            importedImages.push(await this.downloadImage(image, knife.id, index));
          } catch {
            importedImages.push(image);
          }
          continue;
        }

        importedImages.push(image);
      }

      await this.migrateKnife(knife, importedImages);
    }

    await this.clearCompareList();
    await this.migrateCompareList(compareIds);
  }

  async getImage(relativePath: string): Promise<ImageData> {
    const filePath = path.join(IMAGES_DIR, relativePath);
    const resolved = path.resolve(filePath);
    const base = path.resolve(IMAGES_DIR);

    if (!resolved.startsWith(base)) {
      throw new Error('Invalid image path');
    }

    const buffer = await fs.readFile(resolved);
    const ext = path.extname(resolved).toLowerCase();
    const contentType =
      {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.avif': 'image/avif',
        '.svg': 'image/svg+xml',
      }[ext] ?? 'application/octet-stream';

    return { buffer, contentType };
  }
}
