'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  Link2,
  Plus,
  Trash2,
  AlertCircle,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useKnives } from '@/components/providers/knives-provider';

import {
  KnifeFormData,
  EMPTY_KNIFE_FORM,
  KnifeFormFields,
  formDataToKnifeDraft,
} from '@/components/knife-form';
import { ScrapedProduct } from '@/lib/scrape';
import { PageHeader } from '@/components/page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const TABS = ['Scrape URL', 'Manual'] as const;
type Tab = (typeof TABS)[number];

export function AddKnifeForm() {
  const router = useRouter();
  const { addKnife } = useKnives();
  const [activeTab, setActiveTab] = useState<Tab>('Scrape URL');
  const [form, setForm] = useState<KnifeFormData>(EMPTY_KNIFE_FORM);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [url, setUrl] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [hasScraped, setHasScraped] = useState(false);
  const [scrapedHtml, setScrapedHtml] = useState<string>('');
  const [scrapedFinalUrl, setScrapedFinalUrl] = useState<string>('');
  const [showPreview, setShowPreview] = useState(true);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const updateField = <K extends keyof KnifeFormData>(field: K, value: KnifeFormData[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addImageUrl = () => {
    const trimmed = imageUrlInput.trim();
    if (!trimmed) return;
    if (form.images.includes(trimmed)) {
      setImageUrlInput('');
      return;
    }
    updateField('images', [...form.images, trimmed]);
    setSelectedImages((prev) => new Set(prev).add(trimmed));
    setImageUrlInput('');
  };

  const handleImageFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      if (dataUrl && !form.images.includes(dataUrl)) {
        updateField('images', [...form.images, dataUrl]);
        setSelectedImages((prev) => new Set(prev).add(dataUrl));
      }
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (index: number) => {
    const removed = form.images[index];
    updateField('images', form.images.filter((_, i) => i !== index));
    setSelectedImages((prev) => {
      const next = new Set(prev);
      next.delete(removed);
      return next;
    });
  };

  const toggleImageSelection = (src: string) => {
    setSelectedImages((prev) => {
      const next = new Set(prev);
      if (next.has(src)) {
        next.delete(src);
      } else {
        next.add(src);
      }
      return next;
    });
  };

  const selectAllImages = () => {
    setSelectedImages(new Set(form.images));
  };

  const deselectAllImages = () => {
    setSelectedImages(new Set());
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setIsSaving(true);
    try {
      await addKnife(formDataToKnifeDraft(form, selectedImages));
      router.push('/collection');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Failed to save knife');
    } finally {
      setIsSaving(false);
    }
  };

  const handleScrape = async () => {
    if (!url.trim()) return;
    setIsScraping(true);
    setScrapeError(null);
    setHasScraped(false);
    setScrapedHtml('');
    setScrapedFinalUrl('');

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? 'Failed to scrape product page');
      }

      const product = data.product as ScrapedProduct;

      setForm({
        brand: product.brand ?? '',
        name: product.name ?? '',
        handleMaterial: product.handleMaterial ?? '',
        bladeStyle: product.bladeStyle ?? '',
        description: product.description ?? '',
        weight: product.specs?.weight ?? '',
        overallLength: product.specs?.overallLength ?? '',
        bladeLength: product.specs?.bladeLength ?? '',
        bladeThickness: product.specs?.bladeThickness ?? '',
        bladeCoating: product.specs?.bladeCoating ?? '',
        bladeMaterial: product.specs?.bladeMaterial ?? '',
        lockingMechanism: product.specs?.lockingMechanism ?? '',
        designer: product.specs?.designer ?? '',
        modelNumber: product.specs?.modelNumber ?? '',
        handleLength: product.specs?.handleLength ?? '',
        hardness: product.specs?.hardness ?? '',
        country: product.specs?.country ?? '',
        images: Array.isArray(product.images) ? product.images : [],
        sourceUrl: product.sourceUrl ?? url.trim(),
      });
      setSelectedImages(new Set(Array.isArray(product.images) ? product.images : []));
      setScrapedHtml(typeof data.html === 'string' ? data.html : '');
      setScrapedFinalUrl(typeof data.finalUrl === 'string' ? data.finalUrl : url.trim());
      setHasScraped(true);
      setShowPreview(true);
    } catch (error) {
      setScrapeError(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setIsScraping(false);
    }
  };

  const canSave = form.name.trim().length > 0;

  const previewHtml = scrapedHtml
    ? `<base href="${scrapedFinalUrl || form.sourceUrl}">\n${scrapedHtml}`
    : '';

  const scrapeInput = (
    <Card size="sm">
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          <label className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Product URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleScrape()}
                placeholder="https://retailer.com/..."
                className="pl-9"
              />
            </div>
            <Button onClick={handleScrape} disabled={isScraping || !url.trim()} size="sm">
              {isScraping && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {isScraping ? 'Scraping' : 'Scrape'}
            </Button>
          </div>
        </div>

        {scrapeError && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{scrapeError}</span>
          </div>
        )}

        {!hasScraped && !scrapeError && !isScraping && (
          <p className="text-xs text-muted-foreground">
            Paste a knife product page URL and hit Scrape. The app will pull the title, brand, images, and specs when available. You can edit everything before saving.
          </p>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col min-h-0 flex-1 p-6 lg:p-8 w-full max-w-7xl mx-auto">
      <PageHeader
        title="Add Knife"
        description="Scrape a product page or enter details manually."
        breadcrumbs={[{ label: 'Add' }]}
        actions={
          <Button variant="outline" size="sm" onClick={() => router.back()}>
            Cancel
          </Button>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(value) => {
          setActiveTab(value as Tab);
          setScrapeError(null);
          setSaveError(null);
        }}
        className="flex flex-col flex-1 min-h-0 gap-6"
      >
        <TabsList>
          {TABS.map((tab) => (
            <TabsTrigger key={tab} value={tab}>
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {activeTab === 'Scrape URL' && scrapeInput}

        {hasScraped ? (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 flex-1 min-h-0">
            <div className="flex flex-col min-h-0 overflow-y-auto space-y-4 pr-1">
              <KnifeFormFields
                form={form}
                updateField={updateField}
                imageUrlInput={imageUrlInput}
                setImageUrlInput={setImageUrlInput}
                addImageUrl={addImageUrl}
                onImageFileSelect={handleImageFileSelect}
                selectedImages={selectedImages}
                toggleImageSelection={toggleImageSelection}
                selectAllImages={selectAllImages}
                deselectAllImages={deselectAllImages}
                removeImage={removeImage}
              />
            </div>

            <Card className="flex flex-col overflow-hidden h-full min-h-0">
              <CardHeader className="border-b flex flex-row items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                  <CardTitle className="text-sm">Scraped page preview</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => setShowPreview((prev) => !prev)}
                    title={showPreview ? 'Hide preview' : 'Show preview'}
                  >
                    {showPreview ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                  <a
                    href={form.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Open
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              </CardHeader>
              <CardContent className="relative flex-1 min-h-0 p-0">
                {showPreview && previewHtml ? (
                  <iframe
                    title="Scraped page preview"
                    srcDoc={previewHtml}
                    sandbox=""
                    className="absolute inset-0 w-full h-full border-0 bg-white"
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground">
                    <EyeOff className="h-8 w-8 mb-3 opacity-40" />
                    <span className="text-xs">Preview hidden</span>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        ) : (
          activeTab === 'Manual' && (
            <KnifeFormFields
              form={form}
              updateField={updateField}
              imageUrlInput={imageUrlInput}
              setImageUrlInput={setImageUrlInput}
              addImageUrl={addImageUrl}
              selectedImages={selectedImages}
              toggleImageSelection={toggleImageSelection}
              selectAllImages={selectAllImages}
              deselectAllImages={deselectAllImages}
              removeImage={removeImage}
            />
          )
        )}
      </Tabs>

      {saveError && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      <div className="mt-6 flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!canSave || isSaving}>
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {isSaving ? 'Saving' : 'Save Item'}
        </Button>
      </div>
    </div>
  );
}
