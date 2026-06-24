import { NextResponse } from 'next/server';
import {
  scrapeProduct,
  isShopifyProductPage,
  getShopifyJsonUrl,
  extractShopifyProduct,
} from '@/lib/scrape';
import { fetchRenderedHtml } from '@/lib/scrape-playwright';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const url = typeof body.url === 'string' ? body.url.trim() : '';

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    let normalizedUrl: string;
    try {
      normalizedUrl = new URL(url).href;
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    let html: string;
    let finalUrl: string;

    try {
      const rendered = await fetchRenderedHtml(normalizedUrl);
      html = rendered.html;
      finalUrl = rendered.finalUrl;
    } catch (renderError) {
      // Playwright can time out on pages with heavy/never-ending network activity.
      // Many Shopify stores still render the product HTML server-side, so fall
      // back to a plain HTTP fetch before giving up.
      const response = await fetch(normalizedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
        },
      });

      if (!response.ok) {
        throw renderError;
      }

      html = await response.text();
      finalUrl = response.url;
    }

    const { product, confidence } = scrapeProduct(html, finalUrl, normalizedUrl);

    // Shopify stores expose a .json endpoint with all product images and metadata.
    // Use it to augment the rendered-page data when available.
    if (isShopifyProductPage(finalUrl, html)) {
      const jsonUrl = getShopifyJsonUrl(finalUrl);
      if (jsonUrl) {
        try {
          const jsonResponse = await fetch(jsonUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
              'Accept': 'application/json',
              'Accept-Language': 'en-US,en;q=0.9',
            },
          });

          if (jsonResponse.ok) {
            const json = await jsonResponse.json();
            const shopifyProduct = extractShopifyProduct(json);
            if (shopifyProduct) {
              if (shopifyProduct.name) product.name = shopifyProduct.name;
              if (shopifyProduct.brand) product.brand = shopifyProduct.brand;
              if (shopifyProduct.description) product.description = shopifyProduct.description;
              if (shopifyProduct.images?.length) product.images = shopifyProduct.images;
            }
          }
        } catch {
          // Ignore Shopify JSON fetch errors and fall back to rendered-page data.
        }
      }
    }

    return NextResponse.json({ product, confidence, html, finalUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
