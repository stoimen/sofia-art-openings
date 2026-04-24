import type { EventSource, TimeframeFilter } from '../types';
import { sourceLabels } from '../api/events';

export type FilterState = {
  timeframe: TimeframeFilter;
  upcomingOnly: boolean;
  openingsOnly: boolean;
  savedOnly: boolean;
  search: string;
  source: 'all' | EventSource;
  maxDistanceKm: 'all' | number;
};

type FiltersProps = {
  value: FilterState;
  hasLocation: boolean;
  onChange: (nextValue: FilterState) => void;
  onReset: () => void;
};

const timeframeOptions: Array<{ value: TimeframeFilter; label: string }> = [
  { value: 'all', label: 'Всички' },
  { value: 'today', label: 'Днес' },
  { value: 'tomorrow', label: 'Утре' },
  { value: 'week', label: 'Тази седмица' },
];

const distanceOptions = ['all', 1, 3, 5, 10, 20] as const;

export function Filters({ value, hasLocation, onChange, onReset }: FiltersProps) {
  return (
    <section className="filters-panel" aria-labelledby="filters-title">
      <div className="filters-head">
        <div>
          <p className="eyebrow">Филтри</p>
          <h2 id="filters-title">Фокусирайте списъка</h2>
        </div>
        <button type="button" className="ghost-button" onClick={onReset}>
          Нулиране
        </button>
      </div>

      <div className="filter-grid">
        <fieldset className="chip-group">
          <legend className="chip-legend">Дати</legend>
          {timeframeOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === value.timeframe ? 'chip-button active' : 'chip-button'}
              aria-pressed={option.value === value.timeframe}
              onClick={() => onChange({ ...value, timeframe: option.value })}
            >
              {option.label}
            </button>
          ))}
        </fieldset>

        <label className="field">
          <span>Търсене</span>
          <input
            type="search"
            placeholder="Артист, място, квартал…"
            value={value.search}
            onChange={(event) => onChange({ ...value, search: event.target.value })}
          />
        </label>

        <label className="field">
          <span>Източник</span>
          <select
            value={value.source}
            onChange={(event) => onChange({ ...value, source: event.target.value as FilterState['source'] })}
          >
            <option value="all">Всички източници</option>
            {Object.entries(sourceLabels).map(([source, label]) => (
              <option key={source} value={source}>
                {label}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Макс. разстояние</span>
          <select
            value={String(value.maxDistanceKm)}
            disabled={!hasLocation}
            onChange={(event) =>
              onChange({
                ...value,
                maxDistanceKm: event.target.value === 'all' ? 'all' : Number(event.target.value),
              })
            }
          >
            {distanceOptions.map((option) => (
              <option key={String(option)} value={String(option)}>
                {option === 'all' ? 'Без ограничение' : `${option} км`}
              </option>
            ))}
          </select>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={value.upcomingOnly}
            onChange={(event) => onChange({ ...value, upcomingOnly: event.target.checked })}
          />
          <span>Само предстоящи</span>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={value.openingsOnly}
            onChange={(event) => onChange({ ...value, openingsOnly: event.target.checked })}
          />
          <span>Само откривания</span>
        </label>

        <label className="toggle-field">
          <input
            type="checkbox"
            checked={value.savedOnly}
            onChange={(event) => onChange({ ...value, savedOnly: event.target.checked })}
          />
          <span>Само запазени</span>
        </label>
      </div>
    </section>
  );
}
