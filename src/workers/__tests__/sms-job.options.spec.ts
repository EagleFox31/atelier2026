import { SMS_RETRY_OPTIONS, smsJobOptions } from '../sms-job.options';

describe('smsJobOptions', () => {
  it('combine relances bornées, rétention par défaut et jobId', () => {
    expect(smsJobOptions('sms-notification_abc')).toEqual({
      attempts: 3,
      backoff: { type: 'exponential', delay: 60_000 },
      removeOnComplete: { age: 7 * 24 * 60 * 60 },
      removeOnFail: { age: 7 * 24 * 60 * 60 },
      jobId: 'sms-notification_abc',
    });
  });

  it('accepte une rétention propre au producteur', () => {
    expect(smsJobOptions('x_1', { removeOnComplete: true, removeOnFail: { age: 60 } })).toEqual(
      expect.objectContaining({ removeOnComplete: true, removeOnFail: { age: 60 }, attempts: 3 }),
    );
  });

  it('ne partage pas l’objet backoff entre deux jobs', () => {
    const a = smsJobOptions('a_1');
    expect(a.backoff).not.toBe(SMS_RETRY_OPTIONS.backoff);
  });

  it.each([[''], ['  '], ['sms-notification:abc']])('refuse le jobId %p (BullMQ interdit « : »)', (jobId) => {
    expect(() => smsJobOptions(jobId)).toThrow('jobId SMS invalide');
  });
});
