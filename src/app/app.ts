import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, OnDestroy, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';

type HistoryEntry = {
  id: number;
  brl: number;
  clp: number;
};

@Component({
  selector: 'app-root',
  imports: [ReactiveFormsModule, CurrencyPipe, DecimalPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly conversionRate = 178;
  private readonly decimalScale = 100;
  private readonly idleResetMs = 5000;
  private idleTimerId?: number;
  private historyId = 0;

  readonly clpInput = new FormControl<string>('');
  readonly conversionHistory = signal<HistoryEntry[]>([]);

  get clpValue(): number {
    const thousandsValue = this.thousandsValue;
    return Math.round(thousandsValue * 1000);
  }

  get clpInThousands(): number {
    return this.thousandsValue;
  }

  get brlValue(): number {
    return this.clpValue / this.conversionRate;
  }

  onType(): void {
    const rawValue = this.clpInput.value ?? '';
    const normalizedCommas = rawValue.replace(/\./g, ',');
    const allowedCharsOnly = normalizedCommas.replace(/[^\d,]/g, '');

    const [intPartRaw, ...decimalParts] = allowedCharsOnly.split(',');
    const intPart = intPartRaw ?? '';
    const decimalPart = decimalParts.join('').slice(0, 2);
    const hasComma = allowedCharsOnly.includes(',');

    const normalizedValue = decimalPart.length > 0 ? `${intPart},${decimalPart}` : hasComma ? `${intPart},` : intPart;
    this.clpInput.setValue(normalizedValue, { emitEvent: false });

    if (normalizedValue) {
      this.restartIdleTimer();
      return;
    }

    this.clearIdleTimer();
  }

  ngOnDestroy(): void {
    this.clearIdleTimer();
  }

  private parseThousandsValue(rawValue: string): number {
    if (!rawValue.trim()) {
      return 0;
    }

    const normalized = rawValue.replace(',', '.');
    const completed = normalized.endsWith('.') ? normalized.slice(0, -1) : normalized;
    const safeNumber = completed.startsWith('.') ? `0${completed}` : completed;
    const parsedValue = Number(safeNumber);

    return Number.isFinite(parsedValue) ? parsedValue : 0;
  }

  private get thousandsValue(): number {
    const parsed = this.parseThousandsValue(this.clpInput.value ?? '');
    return Math.round(parsed * this.decimalScale) / this.decimalScale;
  }

  private restartIdleTimer(): void {
    this.clearIdleTimer();
    const clpSnapshot = this.clpValue;
    const brlSnapshot = this.brlValue;

    this.idleTimerId = window.setTimeout(() => {
      this.archiveCurrentConversion(clpSnapshot, brlSnapshot);
      this.clpInput.setValue('', { emitEvent: false });
      this.idleTimerId = undefined;
    }, this.idleResetMs);
  }

  private clearIdleTimer(): void {
    if (this.idleTimerId === undefined) {
      return;
    }

    window.clearTimeout(this.idleTimerId);
    this.idleTimerId = undefined;
  }

  private archiveCurrentConversion(clpValue: number, brlValue: number): void {
    if (clpValue <= 0) {
      return;
    }

    this.historyId += 1;
    this.conversionHistory.update((items) => [
      {
        id: this.historyId,
        brl: brlValue,
        clp: clpValue,
      },
      ...items,
    ]);
  }
}
