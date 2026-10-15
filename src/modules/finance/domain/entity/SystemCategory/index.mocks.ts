import { SystemCategoryKey } from '@finance/domain/enum';

// region Mocks

const unknownId = '11111111-1111-4111-8111-111111111111';

// endregion Mocks

const mocks = { key: SystemCategoryKey.BALANCE_ADJUSTMENT, unknownId };
const spies = {};

export { mocks, spies };
