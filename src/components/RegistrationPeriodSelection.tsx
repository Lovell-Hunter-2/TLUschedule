import React, { useState } from 'react';
import { Search, ChevronDown, ChevronUp, ChevronRight, Calendar, Clock, ArrowLeft, Check, Sparkles } from 'lucide-react';
import { Card } from './Card';
import { cn } from '../lib/utils';
import { SemesterRegisterPeriod, SCHOOL_YEAR_REGISTRATIONS } from '../data/registrationData';

interface RegistrationPeriodSelectionProps {
  currentPeriodId?: string;
  onSelectPeriod: (period: SemesterRegisterPeriod) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export function RegistrationPeriodSelection({
  currentPeriodId,
  onSelectPeriod,
  onBack,
  showBackButton = false,
}: RegistrationPeriodSelectionProps) {
  const [searchQuery, setSearchQuery] = useState('');
  // Expanded year accordions - default to '2026-2027' and '2025-2026'
  const [expandedYears, setExpandedYears] = useState<Record<string, boolean>>({
    '2026-2027': true,
    '2025-2026': false,
    '2024-2025': false,
    '2023-2024': false,
    '2022-2023': false,
    '2021-2022': false,
    '2020-2021': false,
  });

  const toggleYear = (year: string) => {
    setExpandedYears((prev) => ({
      ...prev,
      [year]: !prev[year],
    }));
  };

  const filteredPeriods = React.useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase().trim();
    const results: { year: string; period: SemesterRegisterPeriod }[] = [];
    SCHOOL_YEAR_REGISTRATIONS.forEach((group) => {
      group.periods.forEach((p) => {
        if (
          p.name.toLowerCase().includes(q) ||
          p.semesterCode.toLowerCase().includes(q) ||
          p.yearName.toLowerCase().includes(q)
        ) {
          results.push({ year: group.year, period: p });
        }
      });
    });
    return results;
  }, [searchQuery]);

  const renderPeriodItem = (period: SemesterRegisterPeriod, isInsideAccordion = false) => {
    const isSelected = period.id === currentPeriodId;

    return (
      <div
        key={period.id}
        onClick={() => onSelectPeriod(period)}
        className={cn(
          "cursor-pointer transition-all p-3 sm:p-3.5 rounded-xl flex items-center justify-between gap-3 border",
          isSelected
            ? "bg-blue-50/90 dark:bg-blue-950/40 border-blue-300 dark:border-blue-700 shadow-xs"
            : period.isActive
            ? "bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-50/70"
            : isInsideAccordion
            ? "bg-transparent border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60"
            : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-50"
        )}
      >
        <div className="flex flex-col gap-1 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className={cn(
              "font-semibold text-sm leading-snug",
              isSelected ? "text-blue-700 dark:text-blue-300 font-bold" : "text-gray-900 dark:text-gray-100"
            )}>
              {period.name}
            </h4>
            {period.isActive && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-700">
                Đang mở
              </span>
            )}
            {isSelected && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700 flex items-center gap-1">
                <Check className="w-3 h-3" /> Đang chọn
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span>Học kỳ: <strong className="font-mono text-gray-700 dark:text-gray-300">{period.semesterCode}</strong></span>
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />
              <span className={period.timeText === 'Chưa cập nhật' ? 'italic opacity-80' : ''}>
                {period.timeText}
              </span>
            </span>
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-1 text-gray-400">
          <ChevronRight className="w-4 h-4 text-gray-400" />
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4 max-w-4xl mx-auto w-full">
      {/* Header bar */}
      <div className="flex items-center justify-between gap-3 pb-1 border-b border-gray-100 dark:border-gray-800">
        <div className="flex items-center gap-2">
          {showBackButton && onBack && (
            <button
              onClick={onBack}
              className="p-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-300 transition-colors"
              title="Quay lại danh sách môn học"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Chọn đợt đăng ký
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Chọn năm học và đợt đăng ký học phần để tra cứu danh sách lớp mở
            </p>
          </div>
        </div>

        {currentPeriodId && onBack && showBackButton && (
          <button
            onClick={onBack}
            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline"
          >
            Quay lại xem môn học
          </button>
        )}
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Tìm kiếm đợt đăng ký..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-300 focus:border-blue-500 outline-none text-sm transition-all shadow-xs text-gray-800 dark:text-gray-100"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
          >
            ✕
          </button>
        )}
      </div>

      {/* If searching: show search results */}
      {searchQuery.trim() ? (
        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-gray-500 px-1">
            Kết quả tìm kiếm ({filteredPeriods.length} đợt khớp)
          </div>
          {filteredPeriods.length === 0 ? (
            <div className="p-8 text-center text-sm text-gray-400 bg-gray-50 dark:bg-gray-800/40 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
              Không tìm thấy đợt đăng ký nào phù hợp với từ khóa "{searchQuery}".
            </div>
          ) : (
            filteredPeriods.map(({ period }) => renderPeriodItem(period))
          )}
        </div>
      ) : (
        /* Grouped Accordion List by Academic Year */
        <div className="flex flex-col gap-3">
          {SCHOOL_YEAR_REGISTRATIONS.map((group) => {
            const isExpanded = !!expandedYears[group.year];
            const hasSelectedPeriod = group.periods.some((p) => p.id === currentPeriodId);

            return (
              <Card
                key={group.year}
                className={cn(
                  "overflow-hidden border transition-all shadow-xs",
                  hasSelectedPeriod
                    ? "border-blue-200 dark:border-blue-800"
                    : "border-gray-200/80 dark:border-gray-700/80"
                )}
              >
                {/* Year Header Accordion Toggle */}
                <div
                  onClick={() => toggleYear(group.year)}
                  className="p-4 flex items-center justify-between cursor-pointer select-none bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3">
                    <h4 className="font-bold text-base text-gray-900 dark:text-gray-100">
                      {group.year}
                    </h4>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {group.periods.length} đợt đăng ký
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {group.periods.some((p) => p.isActive) && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                        Có đợt đang mở
                      </span>
                    )}
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Periods */}
                {isExpanded && (
                  <div className="p-3 pt-1 border-t border-gray-100 dark:border-gray-700/60 bg-gray-50/50 dark:bg-gray-850/40 flex flex-col gap-2">
                    {group.periods.map((period) => renderPeriodItem(period, true))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
