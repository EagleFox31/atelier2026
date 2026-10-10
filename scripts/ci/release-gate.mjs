#!/usr/bin/env node
// Release gate du workflow « Deploy AWS » : décide si le commit évalué part en
// production. Règles (LESSON-2026-011, issue #83) :
// - Run workflow (workflow_dispatch) : déploiement de la branche choisie ;
// - commit de release = version.txt modifié par rapport au 1er parent (squash ou
//   merge commit de la PR de release AppFactory) ;
// - une release déjà remplacée sur main (re-run d'un ancien CI) n'est pas
//   redéployée : cela ferait revenir la prod en arrière ;
// - tout autre commit : aucun déploiement.
// Sorties : deploy, reason, version (dans $GITHUB_OUTPUT si défini, sinon stdout).
// Une erreur git (historique absent, ref introuvable) fait échouer le job.
import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    const value = argv[i + 1];
    if (!key?.startsWith('--') || value === undefined) {
      throw new Error(`Argument invalide : ${key ?? '(vide)'}`);
    }
    args[key.slice(2)] = value;
  }
  return args;
}

function git(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function versionAt(repo, ref) {
  return git(repo, ['show', `${ref}:version.txt`]).trim();
}

function versionChanged(repo) {
  try {
    git(repo, ['diff', '--quiet', 'HEAD^1', 'HEAD', '--', 'version.txt']);
    return false;
  } catch (error) {
    // git diff --quiet : 1 = différence, autre code = vraie erreur.
    if (error.status === 1) return true;
    throw error;
  }
}

function decide({ event, repo, mainRef }) {
  if (!event) throw new Error('--event est obligatoire');
  const version = versionAt(repo, 'HEAD');

  if (event === 'workflow_dispatch') {
    return { deploy: true, version, reason: `déploiement manuel (Run workflow) de v${version}` };
  }
  if (!versionChanged(repo)) {
    return {
      deploy: false,
      version,
      reason: 'commit hors release : la prod sera mise à jour au merge de la PR de release (ou via Run workflow)',
    };
  }
  if (mainRef) {
    const current = versionAt(repo, mainRef);
    if (current !== version) {
      return {
        deploy: false,
        version,
        reason: `release v${version} déjà remplacée par v${current} sur main : pas de retour arrière`,
      };
    }
  }
  return { deploy: true, version, reason: `release v${version}` };
}

const args = parseArgs(process.argv.slice(2));
const result = decide({ event: args.event, repo: args.repo ?? '.', mainRef: args['main-ref'] });
const lines = `deploy=${result.deploy}\nversion=${result.version}\nreason=${result.reason}\n`;
if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, lines);
process.stdout.write(lines);
