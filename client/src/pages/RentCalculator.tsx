import { useState, useMemo } from 'react';
import { Calculator, PoundSterling, Calendar, TrendingUp, Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { format, getDaysInMonth, addMonths, startOfMonth } from 'date-fns';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ResultCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function FormulaRow({ label, formula }: { label: string; formula: string }) {
  return (
    <div className="flex items-start gap-2 py-1.5 border-b last:border-0">
      <span className="text-xs font-medium text-gray-500 w-40 flex-shrink-0">{label}</span>
      <code className="text-xs text-[#791E75] font-mono">{formula}</code>
    </div>
  );
}

function fmt(n: number, decimals = 2) {
  return `£${n.toLocaleString('en-GB', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

// ─── Pro-Rata Calculator ──────────────────────────────────────────────────────

function ProRataCalculator() {
  const [monthlyRent, setMonthlyRent] = useState('');
  const [moveInDate, setMoveInDate] = useState('');

  const result = useMemo(() => {
    const rent = parseFloat(monthlyRent);
    if (!rent || !moveInDate || isNaN(rent) || rent <= 0) return null;

    const moveIn = new Date(moveInDate);
    const daysInMonth = getDaysInMonth(moveIn);
    const dayOfMonth = moveIn.getDate(); // 1-based
    const daysRemaining = daysInMonth - dayOfMonth + 1; // inclusive of move-in day
    const dailyRate = rent / daysInMonth;
    const proRataAmount = dailyRate * daysRemaining;

    // Next full rent due = 1st of the month following move-in month
    const nextRentDue = startOfMonth(addMonths(moveIn, 1));

    return {
      daysInMonth,
      dayOfMonth,
      daysRemaining,
      dailyRate,
      proRataAmount,
      nextRentDue,
    };
  }, [monthlyRent, moveInDate]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="mb-1.5 block">Monthly Rent (£)</Label>
          <div className="relative">
            <PoundSterling className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              min={0}
              step={50}
              className="pl-9"
              placeholder="e.g. 1500"
              value={monthlyRent}
              onChange={e => setMonthlyRent(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">Move-in Date</Label>
          <div className="relative">
            <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="date"
              className="pl-9"
              value={moveInDate}
              onChange={e => setMoveInDate(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Results */}
      {result ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ResultCard
              label="Daily Rate"
              value={fmt(result.dailyRate)}
              sub={`${result.daysInMonth} days in month`}
            />
            <ResultCard
              label="Days Remaining"
              value={`${result.daysRemaining} days`}
              sub={`Day ${result.dayOfMonth} of ${result.daysInMonth}`}
            />
            <ResultCard
              label="Pro-Rata Amount"
              value={fmt(result.proRataAmount)}
              sub="Due at move-in"
            />
            <ResultCard
              label="Next Full Rent"
              value={format(result.nextRentDue, 'dd MMM yyyy')}
              sub="1st of following month"
            />
          </div>

          {/* Formula breakdown */}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-blue-600" />
              <p className="text-sm font-medium text-blue-800">Formula Used</p>
            </div>
            <div className="space-y-0.5">
              <FormulaRow
                label="Daily Rate"
                formula={`£${monthlyRent} ÷ ${result.daysInMonth} days = ${fmt(result.dailyRate)}/day`}
              />
              <FormulaRow
                label="Days Remaining"
                formula={`${result.daysInMonth} − ${result.dayOfMonth} + 1 = ${result.daysRemaining} days (inclusive)`}
              />
              <FormulaRow
                label="Pro-Rata"
                formula={`${fmt(result.dailyRate)}/day × ${result.daysRemaining} days = ${fmt(result.proRataAmount)}`}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <Calculator className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter monthly rent and move-in date to calculate</p>
        </div>
      )}
    </div>
  );
}

// ─── Commission Calculator ────────────────────────────────────────────────────

function CommissionCalculator() {
  const [monthlyRent, setMonthlyRent] = useState('');
  const [rate, setRate] = useState('');
  const [isPercentage, setIsPercentage] = useState(true);

  const result = useMemo(() => {
    const rent = parseFloat(monthlyRent);
    const rateVal = parseFloat(rate);
    if (!rent || !rateVal || isNaN(rent) || isNaN(rateVal) || rent <= 0 || rateVal <= 0) return null;

    let commission: number;
    let percentageEquiv: number;

    if (isPercentage) {
      commission = rent * rateVal / 100;
      percentageEquiv = rateVal;
    } else {
      commission = rateVal;
      percentageEquiv = (rateVal / rent) * 100;
    }

    const vat = commission * 0.20;
    const totalWithVat = commission + vat;
    const annualCommission = commission * 12;
    const annualWithVat = totalWithVat * 12;

    return { commission, vat, totalWithVat, annualCommission, annualWithVat, percentageEquiv };
  }, [monthlyRent, rate, isPercentage]);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label className="mb-1.5 block">Monthly Rent (£)</Label>
          <div className="relative">
            <PoundSterling className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              type="number"
              min={0}
              step={50}
              className="pl-9"
              placeholder="e.g. 1500"
              value={monthlyRent}
              onChange={e => setMonthlyRent(e.target.value)}
            />
          </div>
        </div>
        <div>
          <Label className="mb-1.5 block">Commission {isPercentage ? '(%)' : '(£ fixed)'}</Label>
          <div className="relative">
            <span className="absolute left-3 top-2 text-gray-400 text-sm font-medium">{isPercentage ? '%' : '£'}</span>
            <Input
              type="number"
              min={0}
              step={isPercentage ? 0.5 : 10}
              className="pl-9"
              placeholder={isPercentage ? 'e.g. 10' : 'e.g. 150'}
              value={rate}
              onChange={e => setRate(e.target.value)}
            />
          </div>
        </div>
        <div className="flex items-center gap-3 pb-1">
          <span className={`text-sm ${!isPercentage ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>Fixed £</span>
          <Switch
            checked={isPercentage}
            onCheckedChange={setIsPercentage}
            className="data-[state=checked]:bg-[#791E75]"
          />
          <span className={`text-sm ${isPercentage ? 'font-semibold text-gray-900' : 'text-gray-400'}`}>Percentage %</span>
        </div>
      </div>

      {/* Results */}
      {result ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ResultCard
              label="Monthly Commission"
              value={fmt(result.commission)}
              sub={`${result.percentageEquiv.toFixed(2)}% of rent`}
            />
            <ResultCard
              label="VAT (20%)"
              value={fmt(result.vat)}
              sub="On commission only"
            />
            <ResultCard
              label="Total inc. VAT"
              value={fmt(result.totalWithVat)}
              sub="Monthly total due"
            />
            <ResultCard
              label="Annual Commission"
              value={fmt(result.annualCommission)}
              sub="ex. VAT"
            />
            <ResultCard
              label="Annual inc. VAT"
              value={fmt(result.annualWithVat)}
              sub="Full year"
            />
            {!isPercentage && (
              <ResultCard
                label="Equivalent Rate"
                value={`${result.percentageEquiv.toFixed(2)}%`}
                sub="Of monthly rent"
              />
            )}
          </div>

          {/* Formula breakdown */}
          <div className="bg-purple-50 rounded-lg p-4 border border-purple-100">
            <div className="flex items-center gap-2 mb-3">
              <Info className="h-4 w-4 text-purple-600" />
              <p className="text-sm font-medium text-purple-800">Formula Used</p>
            </div>
            <div className="space-y-0.5">
              {isPercentage ? (
                <FormulaRow
                  label="Commission"
                  formula={`£${monthlyRent} × ${rate}% = ${fmt(result.commission)}`}
                />
              ) : (
                <FormulaRow
                  label="Commission"
                  formula={`Fixed ${fmt(result.commission)} (${result.percentageEquiv.toFixed(2)}% of rent)`}
                />
              )}
              <FormulaRow
                label="VAT"
                formula={`${fmt(result.commission)} × 20% = ${fmt(result.vat)}`}
              />
              <FormulaRow
                label="Total"
                formula={`${fmt(result.commission)} + ${fmt(result.vat)} = ${fmt(result.totalWithVat)}`}
              />
              <FormulaRow
                label="Annual (ex. VAT)"
                formula={`${fmt(result.commission)} × 12 = ${fmt(result.annualCommission)}`}
              />
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-gray-400">
          <TrendingUp className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Enter monthly rent and commission rate to calculate</p>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RentCalculator() {
  const [tab, setTab] = useState<'prorata' | 'commission'>('prorata');

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 bg-[#791E75]/10 rounded-xl">
          <Calculator className="h-6 w-6 text-[#791E75]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Rent Calculator</h1>
          <p className="text-sm text-gray-500">Pro-rata and commission calculations</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setTab('prorata')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'prorata' ? 'bg-white text-[#791E75] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          Pro-Rata Rent
        </button>
        <button
          onClick={() => setTab('commission')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'commission' ? 'bg-white text-[#791E75] shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
        >
          PCM Commission
        </button>
      </div>

      {/* Content */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        {tab === 'prorata' ? (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">Pro-Rata Rent Calculator</h2>
            <p className="text-sm text-gray-500 mb-5">
              Calculate the partial month rent when a tenant moves in mid-month.
            </p>
            <ProRataCalculator />
          </>
        ) : (
          <>
            <h2 className="text-base font-semibold text-gray-800 mb-1">PCM Commission Calculator</h2>
            <p className="text-sm text-gray-500 mb-5">
              Calculate letting agent commission and VAT on monthly rent.
            </p>
            <CommissionCalculator />
          </>
        )}
      </div>
    </div>
  );
}
