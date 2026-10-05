import html2canvas from 'html2canvas';

// Single-pixel canvas helper to convert oklch/oklab/etc (or any modern color) to standard RGBA
let tempCanvas: HTMLCanvasElement | null = null;
let tempCtx: CanvasRenderingContext2D | null = null;

export function hasUnsupportedColor(colorStr: string): boolean {
  if (!colorStr || typeof colorStr !== 'string') return false;
  const lower = colorStr.toLowerCase();
  return lower.includes('oklch') || lower.includes('oklab') || lower.includes('lab(') || lower.includes('lch(');
}

export function convertColorToRgba(colorStr: string): string {
  if (typeof document === 'undefined') return colorStr;
  if (!colorStr || typeof colorStr !== 'string') return colorStr;
  
  // Check if color contains oklch/oklab or other unsupported functions
  if (!hasUnsupportedColor(colorStr)) {
    return colorStr;
  }

  try {
    if (!tempCanvas) {
      tempCanvas = document.createElement('canvas');
      tempCanvas.width = 1;
      tempCanvas.height = 1;
      tempCtx = tempCanvas.getContext('2d');
    }
    
    if (tempCtx) {
      tempCtx.clearRect(0, 0, 1, 1);
      tempCtx.fillStyle = colorStr;
      tempCtx.fillRect(0, 0, 1, 1);
      const data = tempCtx.getImageData(0, 0, 1, 1).data;
      return `rgba(${data[0]}, ${data[1]}, ${data[2]}, ${data[3] / 255})`;
    }
  } catch (e) {
    // Ignore and fallback
  }
  return 'rgb(128, 128, 128)'; // fallback
}

export function patchWindowGetComputedStyle(targetWindow: Window): () => void {
  if (!targetWindow) return () => {};
  
  const originalGetComputedStyle = targetWindow.getComputedStyle;
  
  targetWindow.getComputedStyle = function (element: Element, pseudoElt?: string | null) {
    const style = originalGetComputedStyle.call(this, element, pseudoElt);
    if (!style) return style;
    
    return new Proxy(style, {
      get(target, prop) {
        if (prop === 'getPropertyValue') {
          return function (property: string) {
            const value = target.getPropertyValue(property);
            if (hasUnsupportedColor(value)) {
              return convertColorToRgba(value);
            }
            return value;
          };
        }
        
        const val = (target as any)[prop];
        
        if (typeof val === 'function') {
          return val.bind(target);
        }
        
        if (hasUnsupportedColor(val)) {
          return convertColorToRgba(val);
        }
        
        return val;
      }
    }) as CSSStyleDeclaration;
  };
  
  return () => {
    targetWindow.getComputedStyle = originalGetComputedStyle;
  };
}

export function patchCssRulePrototype(targetWindow: any): () => void {
  if (!targetWindow || !targetWindow.CSSRule || !targetWindow.CSSRule.prototype) {
    return () => {};
  }
  
  let fallbackApplied = false;
  let originalDescriptor: PropertyDescriptor | undefined;
  
  try {
    originalDescriptor = Object.getOwnPropertyDescriptor(targetWindow.CSSRule.prototype, 'cssText');
    if (originalDescriptor && originalDescriptor.get) {
      const originalGet = originalDescriptor.get;
      Object.defineProperty(targetWindow.CSSRule.prototype, 'cssText', {
        get() {
          try {
            const val = originalGet.call(this);
            if (typeof val === 'string' && hasUnsupportedColor(val)) {
              // Replace oklch/oklab/lab/lch(...) with standard RGB fallback
              return val.replace(/(oklch|oklab|lab|lch)\([^)]+\)/gi, 'rgb(128,128,128)');
            }
            return val;
          } catch (e) {
            return '';
          }
        },
        configurable: true
      });
      fallbackApplied = true;
    }
  } catch (e) {
    console.warn('Failed to patch CSSRule.prototype.cssText', e);
  }
  
  return () => {
    if (fallbackApplied && originalDescriptor) {
      try {
        Object.defineProperty(targetWindow.CSSRule.prototype, 'cssText', originalDescriptor);
      } catch (e) {
        console.error('Failed to restore CSSRule.prototype.cssText', e);
      }
    }
  };
}

export function patchCanvasCreatePattern(targetWindow: any): () => void {
  if (!targetWindow || !targetWindow.CanvasRenderingContext2D || !targetWindow.CanvasRenderingContext2D.prototype) {
    return () => {};
  }
  
  const originalCreatePattern = targetWindow.CanvasRenderingContext2D.prototype.createPattern;
  
  targetWindow.CanvasRenderingContext2D.prototype.createPattern = function (image: any, repetition: string | null) {
    if (image && (image.width === 0 || image.height === 0)) {
      try {
        const ownerDoc = image.ownerDocument || targetWindow.document || document;
        const dummy = ownerDoc.createElement('canvas');
        dummy.width = 1;
        dummy.height = 1;
        return originalCreatePattern.call(this, dummy, repetition || 'repeat');
      } catch (e) {
        console.warn('Failed to substitute 0x0 canvas in createPattern', e);
      }
    }
    return originalCreatePattern.call(this, image, repetition);
  };
  
  return () => {
    try {
      targetWindow.CanvasRenderingContext2D.prototype.createPattern = originalCreatePattern;
    } catch (e) {
      console.error('Failed to restore CanvasRenderingContext2D.prototype.createPattern', e);
    }
  };
}

export default async function safeHtml2Canvas(element: HTMLElement, options: any = {}): Promise<HTMLCanvasElement> {
  if (typeof window === 'undefined') {
    return html2canvas(element, options);
  }

  // Inject standard metrics fix style for image dimensions during html2canvas render
  const style = document.createElement('style');
  try {
    document.head.appendChild(style);
    style.sheet?.insertRule('body > div:last-child img { display: inline-block; }');
  } catch (e) {
    console.error('Failed to inject html2canvas patch style', e);
  }

  // 1. Patch the main window
  const restoreMainGetComputedStyle = patchWindowGetComputedStyle(window);
  const restoreMainCssRule = patchCssRulePrototype(window);
  const restoreMainCreatePattern = patchCanvasCreatePattern(window);
  
  // 2. Prepare custom onclone
  const originalOnClone = options.onclone;
  const safeOptions = {
    ...options,
    onclone: (clonedDocument: Document) => {
      try {
        // Rewrite inline style tags
        const styles = clonedDocument.querySelectorAll('style');
        styles.forEach(style => {
          if (style.textContent && hasUnsupportedColor(style.textContent)) {
            style.textContent = style.textContent.replace(/(oklch|oklab|lab|lch)\([^)]+\)/gi, 'rgb(128,128,128)');
          }
        });
        
        // Also find all elements in the cloned document that have inline oklch/oklab styles and convert them
        const allElements = clonedDocument.querySelectorAll('*');
        allElements.forEach(el => {
          const htmlEl = el as HTMLElement;
          if (htmlEl.style) {
            // Check properties
            ['color', 'backgroundColor', 'borderColor', 'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor', 'outlineColor', 'fill', 'stroke'].forEach(prop => {
              const val = (htmlEl.style as any)[prop];
              if (hasUnsupportedColor(val)) {
                (htmlEl.style as any)[prop] = convertColorToRgba(val);
              }
            });
          }
        });
      } catch (e) {
        console.warn('Failed in oklch style cleanup in cloned document', e);
      }
      
      try {
        if (clonedDocument.defaultView) {
          patchWindowGetComputedStyle(clonedDocument.defaultView);
          patchCssRulePrototype(clonedDocument.defaultView);
          patchCanvasCreatePattern(clonedDocument.defaultView);
        }
      } catch (e) {
        console.warn('Failed to patch cloned window', e);
      }
      
      if (originalOnClone) {
        originalOnClone(clonedDocument);
      }
    }
  };
  
  try {
    return await html2canvas(element, safeOptions);
  } finally {
    // Restore main window patches
    restoreMainGetComputedStyle();
    restoreMainCssRule();
    restoreMainCreatePattern();
    
    // Clean up injected style element
    try {
      if (style && style.parentNode) {
        style.parentNode.removeChild(style);
      }
    } catch (e) {
      console.error('Failed to clean up style element', e);
    }
  }
}
