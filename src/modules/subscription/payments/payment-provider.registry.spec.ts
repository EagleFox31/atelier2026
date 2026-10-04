import type { PaymentProvider } from './payment-provider';
import { PaymentProviderRegistry } from './payment-provider.registry';

const fake = (name: string) => ({ name }) as PaymentProvider;

describe('PaymentProviderRegistry', () => {
  it('defaults the active provider to notchpay', () => {
    expect(new PaymentProviderRegistry([fake('notchpay'), fake('other')], undefined).active().name).toBe('notchpay');
  });

  it('selects the active provider by configuration, case-insensitively', () => {
    expect(new PaymentProviderRegistry([fake('notchpay'), fake('other')], ' Other ').active().name).toBe('other');
  });

  it('fails fast on an unknown configured provider', () => {
    expect(() => new PaymentProviderRegistry([fake('notchpay')], 'cinetpay')).toThrow(/PAYMENT_PROVIDER=cinetpay inconnu/);
  });

  it('refuses two adapters with the same name', () => {
    expect(() => new PaymentProviderRegistry([fake('notchpay'), fake('notchpay')])).toThrow(/deux fois/);
  });

  it('keeps every registered provider reachable for existing payments and webhooks', () => {
    const registry = new PaymentProviderRegistry([fake('notchpay'), fake('other')], 'other');
    expect(registry.get('notchpay').name).toBe('notchpay');
    expect(registry.find('removed')).toBeUndefined();
    expect(() => registry.get('removed')).toThrow(expect.objectContaining({ status: 404 }));
  });
});
