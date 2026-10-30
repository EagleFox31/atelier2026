import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '../..');
const workflow = readFileSync(resolve(root, '.github/workflows/appfactory-interservice-secrets.yml'), 'utf8');
const deployment = readFileSync(resolve(root, 'deploy/scripts/aws-ssm-deploy.sh'), 'utf8');
const bootstrap = readFileSync(resolve(root, 'infra/aws/bootstrap-github-oidc.yml'), 'utf8');

describe('AppFactory ↔ AWS Notify credential safety contract', () => {
  it('accorde à GitHub OIDC les permissions SSM strictement limitées au seul paramètre Notify', () => {
    const policy = bootstrap.match(
      /- PolicyName: ReconcileAtelierNotifyIngestKey([\s\S]*?)(?=\n        - PolicyName:|\n      Tags:)/
    )?.[1];
    expect(policy).toBeDefined();
    expect(policy).toContain('ssm:GetParameter');
    expect(policy).toContain('ssm:PutParameter');
    expect(policy).toContain(
      'parameter/atelier-maitre/prod/notify-ingest-key'
    );
    expect(policy).not.toContain('parameter/atelier-maitre/prod/*');
    expect(policy).not.toContain('ssm:*');
    expect(policy).not.toContain('ssm:GetParametersByPath');
    expect(policy).not.toContain('iam:');
  });

  it('exige la création manuelle et OIDC sans persister le secret dans GitHub', () => {
    expect(workflow).toMatch(/workflow_dispatch:/);
    expect(workflow).not.toMatch(/\bon:\s*\[?\s*push\b/);
    expect(workflow).not.toMatch(/\bon:\s*\[?\s*pull_request\b/);
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('/atelier-maitre/prod/notify-ingest-key');
    expect(workflow).toContain('appfactory-api');
    expect(workflow).toContain('SecureString');
    expect(workflow).not.toMatch(/aws ssm put-parameter[^\n]*--overwrite/);
    expect(workflow).not.toMatch(/>>\\s*['\"]?\\$GITHUB_OUTPUT/);
    expect(workflow).toContain('set +x');
    expect(workflow).toContain('umask 077');
  });

  it('lit un paramètre séparé, sans remplacer le fichier SSM de production ni activer le canal', () => {
    expect(() => execFileSync('bash', ['-n', resolve(root, 'deploy/scripts/aws-ssm-deploy.sh')]))
      .not.toThrow();
    expect(deployment).toContain('/atelier-maitre/prod/notify-ingest-key');
    expect(deployment).toContain('TRIGENYS_NOTIFY_INGEST_KEY');
    expect(deployment).toContain('Notify ingest key conflicts');
    expect(deployment).toContain('existing provider unchanged');
    expect(deployment).not.toContain('ATELIER_META_DISPATCH_ENABLED=true');
    expect(deployment).not.toContain('CUSTOMER_NOTIFICATIONS_MODE=live');
    expect(deployment).not.toContain('WHATSAPP_PROVIDER=trigenys-notify\n');
  });
});
