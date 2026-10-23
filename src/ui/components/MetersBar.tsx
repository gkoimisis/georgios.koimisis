import { useState } from 'preact/hooks';
import type { RunState } from '../../engine/state';
import { emergencyMonths, essentials, netMonthlyIncome, netWorth, relationshipsLevel, totalDebt, wellbeingLevel } from '../../engine/vars';
import { t } from '../../i18n';
import { engine, fmt } from '../engine';
import { CreditGauge } from './CreditGauge';
import { Sparkline } from './Sparkline';

function level(n: number): 'low' | 'mid' | 'high' {
  return n < 34 ? 'low' : n < 67 ? 'mid' : 'high';
}

function Meter({ icon, label, short, value, pct, valueText }: { icon: string; label: string; short: string; value: string; pct: number; valueText: string }) {
  const p = Math.max(3, Math.min(100, pct));
  return (
    <div class="meter" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-valuetext={valueText}>
      <div class="meter-label">
        <span aria-hidden="true">{icon}</span>
        <span class="long" aria-hidden="true">{label}</span>
        <span class="short" aria-hidden="true">{short}</span>
      </div>
      <div class="meter-track">
        <div class={`meter-fill ${level(pct)}`} style={{ width: `${p}%` }} />
      </div>
      <div class="meter-value">{value}</div>
    </div>
  );
}

export function MetersBar({ run, onMenu }: { run: RunState; onMenu: () => void }) {
  const [open, setOpen] = useState(false);
  const l = run.ledger;
  const cash = l.checking + l.savings;
  const em = emergencyMonths(run);
  const moneyPct = l.checking < 0 ? 5 : (em / 6) * 100;
  const debt = totalDebt(run);
  const net = netMonthlyIncome(run, engine.locale);
  const debtPct =
    run.creditScore !== null ? ((run.creditScore - 300) / 550) * 100 - Math.min(40, (debt / Math.max(1, net * 12)) * 100) : debt > 0 ? 35 : 60;
  const wb = wellbeingLevel(run);
  const rel = relationshipsLevel(run);
  const age = Math.floor((run.startAgeMonths + run.month) / 12);
  const months = t('meters.cushion', { n: fmt.num1(em) });
  const score = run.creditScore === null ? t('meters.noScore.short') : String(run.creditScore);
  const debtText = fmt.usdCompact(debt);

  return (
    <header class="topbar">
      <div class="column">
        <div class="topbar-row topbar-meta">
          <button class="age-chip details-toggle" aria-expanded={open} aria-controls="meter-details" onClick={() => setOpen(!open)}>
            {t('meters.age', { n: age })} · {t('intro.chapter', { n: run.chapter })}
            <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
            <span class="sr-only">{open ? t('meters.collapse') : t('meters.expand')}</span>
          </button>
          <span class="nw-chip">
            {t('meters.netWorth')} <strong>{fmt.usdCompact(netWorth(run))}</strong>
          </span>
          <button class="icon-btn" onClick={onMenu} aria-label={t('menu.open')}>
            <span aria-hidden="true">☰</span>
          </button>
        </div>
        {/* Tapping the meters is a pointer shortcut; the details button above is the accessible control. */}
        <div class="meters" onClick={() => setOpen(!open)}>
          <Meter icon="💵" label={t('meters.money')} short={t('meters.money.short')} value={`${fmt.usdCompact(cash)} · ${fmt.num1(em)} mo`} pct={moneyPct} valueText={`${fmt.usd(cash)}, ${months}`} />
          <Meter icon="💳" label={t('meters.debt')} short={t('meters.debt.short')} value={`${debtText} · ${score}`} pct={debtPct} valueText={`${debtText}, ${score}`} />
          <Meter icon="🌿" label={t('meters.wellbeing')} short={t('meters.wellbeing.short')} value={`${Math.round(wb)}`} pct={wb} valueText={`${Math.round(wb)} of 100`} />
          <Meter icon="🤝" label={t('meters.relationships')} short={t('meters.relationships.short')} value={`${Math.round(rel)}`} pct={rel} valueText={`${Math.round(rel)} of 100`} />
        </div>
        {open && (
          <div class="details" id="meter-details">
            <div class="networth">
              <div>
                <div class="tiny muted">{t('meters.netWorth')}</div>
                <div style={{ fontWeight: 800, fontSize: 'var(--fs-lg)' }}>{fmt.usd(netWorth(run))}</div>
              </div>
              <Sparkline points={run.timeline} />
            </div>
            <div class="details-grid" style={{ marginTop: 'var(--space-3)' }}>
              <section>
                <h3>{t('meters.money')}</h3>
                <dl>
                  <dt>{t('meters.checking')}</dt>
                  <dd>{fmt.usd(l.checking)}</dd>
                  <dt>{t('meters.savings')}</dt>
                  <dd>{fmt.usd(l.savings)}</dd>
                  <dt>{t('meters.income')}</dt>
                  <dd>{t('meters.perMonth', { amount: fmt.usd(net) })}</dd>
                  <dt>{t('meters.spending')}</dt>
                  <dd>{t('meters.perMonth', { amount: fmt.usd(essentials(run) + l.wants + l.subscriptions) })}</dd>
                  <dt>{t('meters.autoSave')}</dt>
                  <dd>{t('meters.perMonth', { amount: fmt.usd(l.autoSave) })}</dd>
                </dl>
              </section>
              <section>
                <h3>{t('meters.debt')}</h3>
                <dl>
                  <dt>{t('meters.card')}</dt>
                  <dd>{fmt.usd(l.card)}</dd>
                  <dt>{t('meters.studentLoan')}</dt>
                  <dd>{fmt.usd(l.studentLoan)}</dd>
                </dl>
                <CreditGauge score={run.creditScore} />
              </section>
              <section>
                <h3>{t('meters.wellbeing')}</h3>
                <dl>
                  <dt>{t('meters.stress')}</dt>
                  <dd>{Math.round(100 - run.meters.stress)}</dd>
                  <dt>{t('meters.health')}</dt>
                  <dd>{Math.round(run.meters.health)}</dd>
                  <dt>{t('meters.freeTime')}</dt>
                  <dd>{Math.round(run.meters.freeTime)}</dd>
                </dl>
              </section>
              <section>
                <h3>{t('meters.relationships')}</h3>
                <dl>
                  <dt>{t('meters.friends')}</dt>
                  <dd>{Math.round(run.meters.friends)}</dd>
                  <dt>{t('meters.family')}</dt>
                  <dd>{Math.round(run.meters.family)}</dd>
                  <dt>{t('meters.partner')}</dt>
                  <dd>{Math.round(run.meters.partner)}</dd>
                  <dt>{t('meters.goals')}</dt>
                  <dd>{Math.round(run.meters.goals)}</dd>
                </dl>
              </section>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
