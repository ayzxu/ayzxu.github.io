/* ==========================================================================
   CalculatorWindow — the classic Apple-menu desk accessory: a four-function
   calculator with %, ± and full keyboard support. Styled 1-bit to match.
   ========================================================================== */

import { useEffect, useRef, useState } from 'react';

type Op = '+' | '-' | '*' | '/';

const MAX_DIGITS = 12;

function format(n: number): string {
  if (!Number.isFinite(n)) return 'Error';
  let s = String(n);
  if (s.replace('-', '').replace('.', '').length > MAX_DIGITS) {
    s = n.toPrecision(MAX_DIGITS);
    // strip trailing zeros from precision output
    if (s.includes('.') && !s.includes('e')) {
      s = s.replace(/\.?0+$/, '');
    }
  }
  return s;
}

export default function CalculatorWindow() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [display, setDisplay] = useState('0');

  /* The key handler lives on the wrapper div, which only hears keys while
     focused — grab focus on mount so typing works immediately. */
  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);
  const [acc, setAcc] = useState<number | null>(null);
  const [op, setOp] = useState<Op | null>(null);
  /** true → next digit starts a fresh entry */
  const [fresh, setFresh] = useState(true);

  const apply = (a: number, b: number, o: Op): number => {
    switch (o) {
      case '+':
        return a + b;
      case '-':
        return a - b;
      case '*':
        return a * b;
      case '/':
        return a / b;
    }
  };

  const inputDigit = (d: string) => {
    if (fresh) {
      setDisplay(d === '.' ? '0.' : d);
      setFresh(false);
      return;
    }
    if (d === '.' && display.includes('.')) return;
    if (display.replace('-', '').replace('.', '').length >= MAX_DIGITS) return;
    setDisplay(display === '0' && d !== '.' ? d : display + d);
  };

  const chooseOp = (next: Op) => {
    const current = Number(display);
    if (acc !== null && op !== null && !fresh) {
      const result = apply(acc, current, op);
      setAcc(result);
      setDisplay(format(result));
    } else {
      setAcc(current);
    }
    setOp(next);
    setFresh(true);
  };

  const equals = () => {
    if (acc === null || op === null) return;
    const result = apply(acc, Number(display), op);
    setDisplay(format(result));
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  const clearAll = () => {
    setDisplay('0');
    setAcc(null);
    setOp(null);
    setFresh(true);
  };

  const negate = () => setDisplay(format(-Number(display)));
  const percent = () => setDisplay(format(Number(display) / 100));

  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key;
    if (/^[0-9]$/.test(k)) inputDigit(k);
    else if (k === '.') inputDigit('.');
    else if (k === '+' || k === '-' || k === '*' || k === '/') chooseOp(k);
    else if (k === 'Enter' || k === '=') equals();
    else if (k === 'Escape' || k.toLowerCase() === 'c') clearAll();
    else if (k === '%') percent();
    else if (k === 'Backspace') {
      if (!fresh && display.length > 1) setDisplay(display.slice(0, -1));
      else setDisplay('0');
    } else return;
    e.preventDefault();
  };

  const Key = ({
    label,
    onPress,
    wide,
    active,
  }: {
    label: string;
    onPress: () => void;
    wide?: boolean;
    active?: boolean;
  }) => (
    <button
      type="button"
      className={`calc-key${wide ? ' wide' : ''}${active ? ' active' : ''}`}
      // Keep focus on the wrapper so the keyboard always works; otherwise a
      // clicked key becomes the focus target and Enter/Space re-fire it.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPress}
    >
      {label}
    </button>
  );

  return (
    <div
      ref={rootRef}
      className="calc-content"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerDown={() => rootRef.current?.focus({ preventScroll: true })}
      aria-label="Calculator"
    >
      <div className="calc-display" aria-live="polite">
        {display}
      </div>
      <div className="calc-grid">
        <Key label="C" onPress={clearAll} />
        <Key label="±" onPress={negate} />
        <Key label="%" onPress={percent} />
        <Key label="÷" onPress={() => chooseOp('/')} active={op === '/'} />

        <Key label="7" onPress={() => inputDigit('7')} />
        <Key label="8" onPress={() => inputDigit('8')} />
        <Key label="9" onPress={() => inputDigit('9')} />
        <Key label="×" onPress={() => chooseOp('*')} active={op === '*'} />

        <Key label="4" onPress={() => inputDigit('4')} />
        <Key label="5" onPress={() => inputDigit('5')} />
        <Key label="6" onPress={() => inputDigit('6')} />
        <Key label="−" onPress={() => chooseOp('-')} active={op === '-'} />

        <Key label="1" onPress={() => inputDigit('1')} />
        <Key label="2" onPress={() => inputDigit('2')} />
        <Key label="3" onPress={() => inputDigit('3')} />
        <Key label="+" onPress={() => chooseOp('+')} active={op === '+'} />

        <Key label="0" onPress={() => inputDigit('0')} wide />
        <Key label="." onPress={() => inputDigit('.')} />
        <Key label="=" onPress={equals} />
      </div>
      <p className="win-meta calc-hint">Keyboard works too.</p>
    </div>
  );
}
