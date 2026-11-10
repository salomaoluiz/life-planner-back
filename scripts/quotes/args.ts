// Spec 104 FR 15: options of `yarn quotes:backfill`.
export interface BackfillOptions {
  delayMs: number;
  dryRun: boolean;
  from?: string;
  fx: boolean;
  tickers?: string[];
  to: string;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const TICKER = /^[A-Z0-9.-]{1,12}$/;

function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);

  return value.toISOString().slice(0, 10);
}

export function parseArgs(argv: string[], today: string): BackfillOptions {
  const options: BackfillOptions = {
    delayMs: 500,
    dryRun: false,
    fx: false,
    to: addDays(today, -1),
  };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = (): string => {
      index += 1;

      if (argv[index] === undefined) {
        throw new Error(`${flag} needs a value`);
      }

      return argv[index];
    };

    switch (flag) {
      case '--delay-ms': {
        const delay = Number(value());

        if (!Number.isInteger(delay) || delay < 0) {
          throw new Error('--delay-ms must be a non-negative integer');
        }

        options.delayMs = delay;
        break;
      }
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--from':
        options.from = date(flag, value());
        break;
      case '--fx':
        options.fx = true;
        break;
      case '--tickers':
        options.tickers = value()
          .split(',')
          .map((ticker) => ticker.trim().toUpperCase())
          .filter((ticker) => ticker !== '');

        if (
          options.tickers.length === 0 ||
          options.tickers.some((ticker) => !TICKER.test(ticker))
        ) {
          throw new Error('--tickers must be a comma separated list of valid tickers');
        }

        break;
      case '--to':
        options.to = date(flag, value());
        break;
      default:
        throw new Error(`Unknown option ${flag}`);
    }
  }

  if (options.from && options.from > options.to) {
    throw new Error('--from must not be after --to');
  }

  return options;
}

function date(flag: string, value: string): string {
  if (!DATE.test(value) || Number.isNaN(new Date(`${value}T00:00:00.000Z`).getTime())) {
    throw new Error(`${flag} must be a date YYYY-MM-DD`);
  }

  return value;
}
