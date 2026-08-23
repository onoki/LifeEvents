import { parseLocalCalendarDate } from '../date-utils';
import { parseTSVData } from '../data-processing-utils';

describe('spreadsheet section parsing', () => {
  it('parses sections independently of their order and preserves cost-category order', () => {
    const tsv = [
      'after_goal_monthly_category\tafter_goal_monthly_sum\tafter_goal_monthly_skip_inflation\t\t',
      ' Housing \t1 200,50\t X ',
      'Internet\t80\t',
      'Invalid amount\t12oops\t',
      'Negative cost\t-1\t',
      'Invalid skip marker\t10\tyes',
      '\t30\t',
      '',
      'mini_reward_percentage\tmini_reward_taken',
      '50\tx',
      '',
      'investment_date\tstocks_in_eur\teunl_rate_to_trend',
      '2026-08-01\t1000\t1.1',
      'not-a-date\t2000\t1.2',
      '',
      'condition\texplanation_short\texplanation_long',
      '500000\tHalfway\tReached the midpoint',
      '',
      'investment_goal\t1000000',
      'annual_inflation_rate\t0.02',
    ].join('\r\n');

    const parsed = parseTSVData(tsv);

    expect(parsed.afterGoalMonthlyCosts).toEqual([
      { category: 'Housing', monthlySum: 1200.5, skipInflation: true },
      { category: 'Internet', monthlySum: 80, skipInflation: false },
    ]);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.data[0]).toEqual(expect.objectContaining({
      investment_date: parseLocalCalendarDate('2026-08-01'),
      stocks_in_eur: '1000',
      eunl_rate_to_trend: '1.1',
    }));
    expect(parsed.conditions).toEqual([{
      condition: '500000',
      explanation_short: 'Halfway',
      explanation_long: 'Reached the midpoint',
    }]);
    expect(parsed.miniRewards).toEqual([{
      percentage: 50,
      taken: true,
      takenRaw: 'x',
    }]);
    expect(parsed.config).toEqual({
      investment_goal: '1000000',
      annual_inflation_rate: '0.02',
    });
  });

  it('strictly rejects the legacy date header', () => {
    const legacyTsv = [
      'date\tstocks_in_eur',
      '2026-08-01\t1000',
    ].join('\n');

    expect(() => parseTSVData(legacyTsv)).toThrow(
      'Investment data must use the "investment_date" header; the legacy "date" header is not supported.'
    );
  });

  it('reports a missing canonical investment header clearly', () => {
    expect(() => parseTSVData('investment_goal\t1000000')).toThrow(
      'Missing required investment data header "investment_date".'
    );
  });

  it('recognizes configuration rows directly after a section without a blank separator', () => {
    const tsv = [
      'after_goal_monthly_category\tafter_goal_monthly_sum\tafter_goal_monthly_skip_inflation',
      'Housing\t1200\t',
      'investment_goal\t1000000',
      'annual_growth_rate_long_term\t0.07',
      'investment_date\tstocks_in_eur',
      '2026-08-01\t1000',
      'annual_inflation_rate\t0.02',
    ].join('\n');

    const parsed = parseTSVData(tsv);

    expect(parsed.afterGoalMonthlyCosts).toEqual([
      { category: 'Housing', monthlySum: 1200, skipInflation: false },
    ]);
    expect(parsed.data).toHaveLength(1);
    expect(parsed.config).toEqual({
      investment_goal: '1000000',
      annual_growth_rate_long_term: '0.07',
      annual_inflation_rate: '0.02',
    });
  });
});
