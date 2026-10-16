import { Search } from 'lucide-react';
import '../../styles/listFilters.css';

export type FilterOption = { value: string; label: string };
export default function ListFilters({ query, onQuery, placeholder = 'Search', filters = [] }: {
  query: string; onQuery: (value: string) => void; placeholder?: string;
  filters?: { label: string; value: string; options: FilterOption[]; onChange: (value: string) => void }[];
}) {
  return <div className="list-filters">
    <label className="list-filter-search"><span><Search size={16} aria-hidden="true"/> {placeholder}</span><input type="search" value={query} onChange={e => onQuery(e.target.value)} placeholder={placeholder}/></label>
    {filters.map(filter => <label key={filter.label}><span>{filter.label}</span><select value={filter.value} onChange={e => filter.onChange(e.target.value)}>{filter.options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>)}
  </div>;
}
