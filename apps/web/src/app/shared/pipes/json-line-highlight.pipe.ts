import type { PipeTransform} from '@angular/core';
import { Pipe, inject } from '@angular/core';
import type { SafeHtml } from '@angular/platform-browser';
import { DomSanitizer } from '@angular/platform-browser';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

@Pipe({
  name: 'jsonLineHighlight',
  standalone: true,
})
export class JsonLineHighlightPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(line: string): SafeHtml {
    let h = escapeHtml(line);
    h = h.replace(
      /^(\s*)("(?:[^"\\]|\\.)*")\s*(:)/,
      (_m, ws: string, key: string, colon: string) =>
        `${ws}<span class="json-line-highlight__key">${key}</span>${colon}`,
    );
    h = h.replace(
      /:\s*("(?:[^"\\]|\\.)*")(\s*,?\s*)$/,
      (_m, str: string, tail: string) => `: <span class="json-line-highlight__str">${str}</span>${tail}`,
    );
    h = h.replace(
      /:\s*(\d+)(\s*,?\s*)$/,
      (_m, num: string, tail: string) => `: <span class="json-line-highlight__num">${num}</span>${tail}`,
    );
    h = h.replace(
      /:\s*(true|false)(\s*,?\s*)$/,
      (_m, bool: string, tail: string) => `: <span class="json-line-highlight__bool">${bool}</span>${tail}`,
    );
    h = h.replace(
      /:\s*(null)(\s*,?\s*)$/,
      (_m, v: string, tail: string) => `: <span class="json-line-highlight__null">${v}</span>${tail}`,
    );
    return this.sanitizer.bypassSecurityTrustHtml(h);
  }
}
