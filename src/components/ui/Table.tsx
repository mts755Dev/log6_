import { cn } from '../../utils/cn';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  emptyMessage?: string;
  isLoading?: boolean;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  isLoading = false,
}: TableProps<T>) {
  const alignClasses = {
    left: 'text-left',
    center: 'text-center',
    right: 'text-right',
  };

  if (isLoading) {
    return (
      <div className="table-container">
        <div className="p-12 text-center">
          <div className="spinner w-8 h-8 mx-auto mb-4" />
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="table-container">
        <div className="p-12 text-center">
          <p className="text-slate-400">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="table-container overflow-x-auto">
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={cn(alignClasses[column.align || 'left'])}
                style={{ width: column.width }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              onClick={() => onRowClick?.(item)}
              className={cn(onRowClick && 'cursor-pointer hover:bg-slate-800/50 transition-colors')}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={cn(alignClasses[column.align || 'left'])}
                >
                  {column.render
                    ? column.render(item)
                    : (item as Record<string, unknown>)[column.key]?.toString()}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

