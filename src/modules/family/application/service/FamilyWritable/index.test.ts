import { FamilyStatus } from '@family/domain/enum';

import { ensureFamilyWritable } from './index';

describe('ensureFamilyWritable', () => {
  it('SHOULD throw 422 "Family is archived" for an archived family', () => {
    expect(() => ensureFamilyWritable({ status: FamilyStatus.ARCHIVED })).toThrow(
      'Family is archived',
    );
  });

  it('SHOULD pass for an active family', () => {
    expect(() => ensureFamilyWritable({ status: FamilyStatus.ACTIVE })).not.toThrow();
  });
});
