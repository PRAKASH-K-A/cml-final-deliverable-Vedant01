import { Component, OnInit, OnDestroy, Output, EventEmitter } from '@angular/core';
import { interval, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface HeatmapStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  marketCap: number;
  volume: number;
  sector: string;
}

@Component({
  selector: 'app-market-heatmap',
  template: `
    <div class="heatmap-container">
      <div class="heatmap-header">
        <h3>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7"/>
            <rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/>
            <rect x="3" y="14" width="7" height="7"/>
          </svg>
          Market Heatmap
        </h3>
        <div class="heatmap-controls">
          <select [(ngModel)]="sortBy" (change)="sortStocks()">
            <option value="change">By Change %</option>
            <option value="volume">By Volume</option>
            <option value="marketCap">By Market Cap</option>
          </select>
          <select [(ngModel)]="sectorFilter" (change)="filterStocks()">
            <option value="all">All Sectors</option>
            <option *ngFor="let sector of sectors" [value]="sector">{{ sector }}</option>
          </select>
        </div>
      </div>
      
      <div class="heatmap-legend">
        <div class="legend-item">
          <span class="legend-box negative-3"></span>
          <span>-3%+</span>
        </div>
        <div class="legend-item">
          <span class="legend-box negative-2"></span>
          <span>-2%</span>
        </div>
        <div class="legend-item">
          <span class="legend-box negative-1"></span>
          <span>-1%</span>
        </div>
        <div class="legend-item">
          <span class="legend-box neutral"></span>
          <span>0%</span>
        </div>
        <div class="legend-item">
          <span class="legend-box positive-1"></span>
          <span>+1%</span>
        </div>
        <div class="legend-item">
          <span class="legend-box positive-2"></span>
          <span>+2%</span>
        </div>
        <div class="legend-item">
          <span class="legend-box positive-3"></span>
          <span>+3%+</span>
        </div>
      </div>
      
      <div class="heatmap-grid">
        <div class="heatmap-cell" 
             *ngFor="let stock of filteredStocks"
             [class]="getHeatClass(stock.change)"
             [style.flex-grow]="getSize(stock)"
             (click)="selectStock(stock)">
          <div class="cell-content">
            <span class="cell-symbol">{{ stock.symbol }}</span>
            <span class="cell-change" [class.positive]="stock.change >= 0" [class.negative]="stock.change < 0">
              {{ stock.change >= 0 ? '+' : '' }}{{ stock.change | number:'1.2-2' }}%
            </span>
            <span class="cell-price">\${{ stock.price | number:'1.2-2' }}</span>
          </div>
        </div>
      </div>
      
      <div class="market-summary">
        <div class="summary-item">
          <span class="label">Gainers</span>
          <span class="value positive">{{ gainersCount }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Losers</span>
          <span class="value negative">{{ losersCount }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Unchanged</span>
          <span class="value">{{ unchangedCount }}</span>
        </div>
        <div class="summary-item">
          <span class="label">Avg Change</span>
          <span class="value" [class.positive]="avgChange >= 0" [class.negative]="avgChange < 0">
            {{ avgChange >= 0 ? '+' : '' }}{{ avgChange | number:'1.2-2' }}%
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .heatmap-container {
      background: #0d1117;
      border-radius: 12px;
      border: 1px solid #21262d;
      overflow: hidden;
    }
    
    .heatmap-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #21262d;
      
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 700;
        color: #e6edf3;
        display: flex;
        align-items: center;
        gap: 10px;
        
        svg { color: #a371f7; }
      }
    }
    
    .heatmap-controls {
      display: flex;
      gap: 10px;
      
      select {
        padding: 6px 10px;
        background: #161b22;
        border: 1px solid #30363d;
        border-radius: 6px;
        color: #e6edf3;
        font-size: 12px;
        cursor: pointer;
        
        &:focus { outline: none; border-color: #58a6ff; }
      }
    }
    
    .heatmap-legend {
      display: flex;
      justify-content: center;
      gap: 12px;
      padding: 12px 20px;
      border-bottom: 1px solid #21262d;
      background: #161b22;
    }
    
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: #8b949e;
    }
    
    .legend-box {
      width: 16px;
      height: 16px;
      border-radius: 3px;
    }
    
    .legend-box.negative-3 { background: #b62324; }
    .legend-box.negative-2 { background: #da3633; }
    .legend-box.negative-1 { background: #f85149; }
    .legend-box.neutral { background: #484f58; }
    .legend-box.positive-1 { background: #3fb950; }
    .legend-box.positive-2 { background: #2ea043; }
    .legend-box.positive-3 { background: #238636; }
    
    .heatmap-grid {
      display: flex;
      flex-wrap: wrap;
      padding: 12px;
      gap: 4px;
      min-height: 200px;
    }
    
    .heatmap-cell {
      min-width: 80px;
      min-height: 60px;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      justify-content: center;
      
      &:hover {
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        z-index: 10;
      }
      
      &.heat-negative-3 { background: linear-gradient(135deg, #b62324, #8b1a1b); }
      &.heat-negative-2 { background: linear-gradient(135deg, #da3633, #b62324); }
      &.heat-negative-1 { background: linear-gradient(135deg, #f85149, #da3633); }
      &.heat-neutral { background: linear-gradient(135deg, #484f58, #30363d); }
      &.heat-positive-1 { background: linear-gradient(135deg, #3fb950, #2ea043); }
      &.heat-positive-2 { background: linear-gradient(135deg, #2ea043, #238636); }
      &.heat-positive-3 { background: linear-gradient(135deg, #238636, #196c2e); }
    }
    
    .cell-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 8px;
    }
    
    .cell-symbol {
      font-size: 14px;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .cell-change {
      font-size: 12px;
      font-weight: 700;
      color: white;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }
    
    .cell-price {
      font-size: 10px;
      color: rgba(255, 255, 255, 0.8);
      font-family: 'SF Mono', monospace;
    }
    
    .market-summary {
      display: flex;
      justify-content: space-around;
      padding: 14px 20px;
      background: #161b22;
      border-top: 1px solid #21262d;
    }
    
    .summary-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      
      .label {
        font-size: 10px;
        font-weight: 600;
        color: #8b949e;
        text-transform: uppercase;
      }
      
      .value {
        font-size: 16px;
        font-weight: 700;
        color: #e6edf3;
        
        &.positive { color: #3fb950; }
        &.negative { color: #f85149; }
      }
    }
  `]
})
export class MarketHeatmapComponent implements OnInit, OnDestroy {
  @Output() stockSelect = new EventEmitter<HeatmapStock>();
  
  stocks: HeatmapStock[] = [];
  filteredStocks: HeatmapStock[] = [];
  sectors: string[] = [];
  
  sortBy = 'change';
  sectorFilter = 'all';
  
  gainersCount = 0;
  losersCount = 0;
  unchangedCount = 0;
  avgChange = 0;
  
  private destroy$ = new Subject<void>();
  
  ngOnInit(): void {
    this.initializeStocks();
    this.calculateStats();
    
    // Update periodically
    interval(3000).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => this.updatePrices());
  }
  
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
  
  private initializeStocks(): void {
    const stockData = [
      { symbol: 'AAPL', name: 'Apple', sector: 'Technology', price: 178.50, marketCap: 2800 },
      { symbol: 'MSFT', name: 'Microsoft', sector: 'Technology', price: 415.20, marketCap: 3100 },
      { symbol: 'GOOGL', name: 'Alphabet', sector: 'Technology', price: 141.80, marketCap: 1800 },
      { symbol: 'AMZN', name: 'Amazon', sector: 'Consumer', price: 178.90, marketCap: 1850 },
      { symbol: 'NVDA', name: 'NVIDIA', sector: 'Technology', price: 875.30, marketCap: 2200 },
      { symbol: 'TSLA', name: 'Tesla', sector: 'Automotive', price: 175.50, marketCap: 550 },
      { symbol: 'META', name: 'Meta', sector: 'Technology', price: 505.20, marketCap: 1300 },
      { symbol: 'JPM', name: 'JPMorgan', sector: 'Financial', price: 198.40, marketCap: 570 },
      { symbol: 'V', name: 'Visa', sector: 'Financial', price: 285.30, marketCap: 580 },
      { symbol: 'JNJ', name: 'Johnson', sector: 'Healthcare', price: 156.80, marketCap: 380 },
      { symbol: 'WMT', name: 'Walmart', sector: 'Consumer', price: 165.20, marketCap: 445 },
      { symbol: 'XOM', name: 'Exxon', sector: 'Energy', price: 115.40, marketCap: 480 },
      { symbol: 'DIS', name: 'Disney', sector: 'Entertainment', price: 112.50, marketCap: 205 },
      { symbol: 'NFLX', name: 'Netflix', sector: 'Entertainment', price: 605.80, marketCap: 265 },
      { symbol: 'AMD', name: 'AMD', sector: 'Technology', price: 178.90, marketCap: 290 },
      { symbol: 'INTC', name: 'Intel', sector: 'Technology', price: 42.30, marketCap: 180 },
    ];
    
    this.stocks = stockData.map(s => ({
      ...s,
      change: (Math.random() - 0.5) * 6,
      volume: Math.floor(1000000 + Math.random() * 10000000)
    }));
    
    this.sectors = [...new Set(this.stocks.map(s => s.sector))];
    this.filteredStocks = [...this.stocks];
    this.sortStocks();
  }
  
  private updatePrices(): void {
    this.stocks.forEach(stock => {
      const changeAdjust = (Math.random() - 0.5) * 0.5;
      stock.change = Math.max(-5, Math.min(5, stock.change + changeAdjust));
      stock.price *= (1 + (Math.random() - 0.5) * 0.002);
    });
    this.filterStocks();
    this.calculateStats();
  }
  
  private calculateStats(): void {
    this.gainersCount = this.stocks.filter(s => s.change > 0.1).length;
    this.losersCount = this.stocks.filter(s => s.change < -0.1).length;
    this.unchangedCount = this.stocks.filter(s => Math.abs(s.change) <= 0.1).length;
    this.avgChange = this.stocks.reduce((sum, s) => sum + s.change, 0) / this.stocks.length;
  }
  
  sortStocks(): void {
    this.filteredStocks.sort((a, b) => {
      switch (this.sortBy) {
        case 'volume': return b.volume - a.volume;
        case 'marketCap': return b.marketCap - a.marketCap;
        default: return Math.abs(b.change) - Math.abs(a.change);
      }
    });
  }
  
  filterStocks(): void {
    this.filteredStocks = this.sectorFilter === 'all'
      ? [...this.stocks]
      : this.stocks.filter(s => s.sector === this.sectorFilter);
    this.sortStocks();
  }
  
  getHeatClass(change: number): string {
    if (change < -2) return 'heat-negative-3';
    if (change < -1) return 'heat-negative-2';
    if (change < -0.1) return 'heat-negative-1';
    if (change > 2) return 'heat-positive-3';
    if (change > 1) return 'heat-positive-2';
    if (change > 0.1) return 'heat-positive-1';
    return 'heat-neutral';
  }
  
  getSize(stock: HeatmapStock): number {
    return Math.max(1, Math.log(stock.marketCap / 100));
  }
  
  selectStock(stock: HeatmapStock): void {
    this.stockSelect.emit(stock);
  }
}
