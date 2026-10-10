import { AppController } from './app.controller';

describe('AppController.health', () => {
  const saved = { version: process.env.APP_VERSION, commit: process.env.APP_COMMIT };

  afterEach(() => {
    process.env.APP_VERSION = saved.version;
    process.env.APP_COMMIT = saved.commit;
    if (saved.version === undefined) delete process.env.APP_VERSION;
    if (saved.commit === undefined) delete process.env.APP_COMMIT;
  });

  it("renvoie la version et le commit de l'image (vérifiés après déploiement)", () => {
    process.env.APP_VERSION = 'v1.16.0';
    process.env.APP_COMMIT = '6975f76dffbaabf3d55097df5799ec6f2bed5bbc';
    expect(new AppController().health()).toMatchObject({
      status: 'ok',
      version: 'v1.16.0',
      commit: '6975f76dffbaabf3d55097df5799ec6f2bed5bbc',
    });
  });

  it('reste lisible hors image de production', () => {
    delete process.env.APP_VERSION;
    delete process.env.APP_COMMIT;
    expect(new AppController().health()).toMatchObject({ status: 'ok', version: 'dev', commit: 'unknown' });
  });
});
