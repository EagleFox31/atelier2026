# Changelog

## [1.15.0](https://github.com/EagleFox31/atelier2026/compare/v1.14.0...v1.15.0) (2026-10-09)


### Features

* **billing:** secure public quote link for customer approval over WhatsApp ([161eac3](https://github.com/EagleFox31/atelier2026/commit/161eac34f589fae7ad0e9a4fea1061f1b22a13fa))
* **billing:** secure public quote link for customer approval over WhatsApp ([e420773](https://github.com/EagleFox31/atelier2026/commit/e4207737e282af6e32eb8a95ef319958de863530))
* **messaging:** shared messaging contracts for customer notifications ([d2ec28d](https://github.com/EagleFox31/atelier2026/commit/d2ec28d52b3dbdacae12a4f500e842032d4ee67d))
* **messaging:** shared messaging contracts for customer notifications (lot 2 PR 2/8) ([a614f42](https://github.com/EagleFox31/atelier2026/commit/a614f42ba19d2124925ec873424da90a5330323d))
* **notifications:** add customer notification schema for WhatsApp-first messaging ([b1db50b](https://github.com/EagleFox31/atelier2026/commit/b1db50bd1f8820fac4eb68c71e8bbca9c8ca844e))
* **notifications:** appointment reminders and invoice payment reminders over WhatsApp ([c85525c](https://github.com/EagleFox31/atelier2026/commit/c85525cd3afdd6e539cfb8f9a6ac8704cd8da13c))
* **notifications:** appointment reminders and invoice payment reminders over WhatsApp ([ad179b9](https://github.com/EagleFox31/atelier2026/commit/ad179b9194df79747e18baf9216a46a8e20ca225))
* **notifications:** customer consent, garage preferences and notification history ([e494e92](https://github.com/EagleFox31/atelier2026/commit/e494e92badb81607ef81ac2020a64a29b582ab7f))
* **notifications:** customer consent, preferences and history (PR 4/8) ([9682579](https://github.com/EagleFox31/atelier2026/commit/9682579fb95964a6bc86589baf7dd92445e85c6a))
* **notifications:** customer notification engine (PR 3/8) ([3064670](https://github.com/EagleFox31/atelier2026/commit/306467034584e656d05c00e3674b7f39d7c040e7))
* **notifications:** customer notification engine with outbox, dispatch rules and whatsapp entitlement ([3afa38d](https://github.com/EagleFox31/atelier2026/commit/3afa38d490671ba0366576fb434f67756cdf98b6))
* **notifications:** customer notification schema (WhatsApp-first, lot 2 PR 1/8) ([48fd0e4](https://github.com/EagleFox31/atelier2026/commit/48fd0e45dbcf2c011d7f016d93dfc543896b2da2))
* **notifications:** emit customer notifications from planning, workshop and billing ([ee40413](https://github.com/EagleFox31/atelier2026/commit/ee4041321e1aadb0f88bb8c64d533897aef34a25))
* **notifications:** emit customer notifications from planning, workshop and billing ([fb98eea](https://github.com/EagleFox31/atelier2026/commit/fb98eeafdc8d79237d97e4e4f48b25f5dd8aa3d6))
* **notifications:** SUPER_ADMIN health view and operations runbook for customer notifications ([d0d0e73](https://github.com/EagleFox31/atelier2026/commit/d0d0e7398a3bf2c27aecd1e269dc61e1f649f2f5))
* **notifications:** SUPER_ADMIN health view and operations runbook for customer notifications ([b092d31](https://github.com/EagleFox31/atelier2026/commit/b092d314524ea058504871f5817dc550835a22dc))

## [1.14.0](https://github.com/EagleFox31/atelier2026/compare/v1.13.0...v1.14.0) (2026-10-09)


### Features

* **messaging:** add Unimatrix SMS provider ([1827633](https://github.com/EagleFox31/atelier2026/commit/18276334dc11d97289946a96d1febbe29af9a842))
* **messaging:** add Unimatrix SMS provider ([bcff4de](https://github.com/EagleFox31/atelier2026/commit/bcff4de542c0a166b94e03dd9380b72a84738fdf))
* **notifications:** add a platform-only WhatsApp template test send ([ead65c8](https://github.com/EagleFox31/atelier2026/commit/ead65c8a6e9a1b23b8bc63481f2e5fb805551ad7))
* **notifications:** add a platform-only WhatsApp template test send ([8b23e8f](https://github.com/EagleFox31/atelier2026/commit/8b23e8fee8d8ffe778a6407f80add24a919ccdad))


### Bug Fixes

* **auth:** stop the ADMIN bypass from opening SUPER_ADMIN routes ([317dcc8](https://github.com/EagleFox31/atelier2026/commit/317dcc88cbed17db5820ec7156b84f248012159d))
* **auth:** stop the ADMIN bypass from opening SUPER_ADMIN routes ([e207967](https://github.com/EagleFox31/atelier2026/commit/e2079672943504ab33df5b3d9cc3a43577dcda63))
* **messaging:** map Unimtx signature errors 107120-107123 to SENDER_REJECTED ([c8526ee](https://github.com/EagleFox31/atelier2026/commit/c8526ee41a300874ac3045fbf64e147fcc7a4d4c))
* **messaging:** map Unimtx signature errors to SENDER_REJECTED ([71b279b](https://github.com/EagleFox31/atelier2026/commit/71b279bfda6156eec0e5e263280e308caef18f89))
* **notifications:** keep the Meta message id out of WhatsApp test logs ([0f50673](https://github.com/EagleFox31/atelier2026/commit/0f506732d2581115b6fe2d5dcd589a0434f8b40b))
* **subscription:** diagnose rejected NotchPay webhook signatures ([bf0d276](https://github.com/EagleFox31/atelier2026/commit/bf0d2762aed4e3303ac52b17bb8726195a804f04))
* **subscription:** log a secret-free diagnostic when a NotchPay webhook signature is rejected ([0b01a3f](https://github.com/EagleFox31/atelier2026/commit/0b01a3f15244ed9b3c33ca00f6b0dfa96d7ad0ed))

## [1.13.0](https://github.com/EagleFox31/atelier2026/compare/v1.12.0...v1.13.0) (2026-10-08)


### Features

* **messaging:** add WhatsApp Cloud API provider adapter ([b178c65](https://github.com/EagleFox31/atelier2026/commit/b178c6555d53d811ec5445cb4c1659c5904aa660))
* **messaging:** add WhatsApp Cloud API provider adapter ([bde26ad](https://github.com/EagleFox31/atelier2026/commit/bde26ad827a04ff048a8c78688b19b0ed72c51cd))
* **messaging:** read SMS.to delivery status by polling ([e275c23](https://github.com/EagleFox31/atelier2026/commit/e275c236a2fa5cdbb712d7c26947b27ead60ff61))
* **messaging:** read SMS.to delivery status by polling ([adde987](https://github.com/EagleFox31/atelier2026/commit/adde987f5a8cdc408118d9d5ce6182cf70b2a5dc))

## [1.12.0](https://github.com/EagleFox31/atelier2026/compare/v1.11.0...v1.12.0) (2026-10-08)


### Features

* **messaging:** add SMS.to SMS provider adapter ([23e8933](https://github.com/EagleFox31/atelier2026/commit/23e8933c10e39f8922b6187ac3d5aa114243db19))
* **messaging:** add SMS.to SMS provider adapter ([c780673](https://github.com/EagleFox31/atelier2026/commit/c780673f2e42a96a48f48599c098f4ad607617fd))
* **subscription:** pluggable payment provider registry ([de862b2](https://github.com/EagleFox31/atelier2026/commit/de862b257b14655dc69e14c033b406b05464b2b3))
* **subscription:** pluggable payment provider registry ([372b87f](https://github.com/EagleFox31/atelier2026/commit/372b87f08567754a33869827bd4f20f663460b28))


### Bug Fixes

* **messaging:** type env fixtures in SMS.to provider tests ([db1f8ad](https://github.com/EagleFox31/atelier2026/commit/db1f8ad354f15396cc97b05ab5abf4b5d4d708d4))

## [1.11.0](https://github.com/EagleFox31/atelier2026/compare/v1.10.0...v1.11.0) (2026-10-02)


### Features

* **subscription:** reconcile pending payments with NotchPay without relying on webhooks ([251de8d](https://github.com/EagleFox31/atelier2026/commit/251de8d7f0930f4ef75df749cb14d819d7c39e75))
* **subscription:** reconcile pending payments with NotchPay without relying on webhooks ([3b2a714](https://github.com/EagleFox31/atelier2026/commit/3b2a7146b4cfc04e5674fbf672d2e6872f7d3c09))

## [1.10.0](https://github.com/EagleFox31/atelier2026/compare/v1.9.0...v1.10.0) (2026-10-02)


### Features

* **auth:** one-time temporary passwords and forced password change screen ([cde86e0](https://github.com/EagleFox31/atelier2026/commit/cde86e0dbf19ed1f3784642553bc625c52aa299f))
* **billing:** show the Atelier Maître brand unless the plan includes custom branding ([5bdd3a2](https://github.com/EagleFox31/atelier2026/commit/5bdd3a277b5c23e3d67adc68e5c561ad6a069f3b))
* **billing:** show the Atelier Maître brand unless the plan includes custom branding ([85b5be0](https://github.com/EagleFox31/atelier2026/commit/85b5be01ce71f8bade1e5e6821232113eedb0b02))
* **messaging:** introduce provider abstraction for SMS and WhatsApp ([481510d](https://github.com/EagleFox31/atelier2026/commit/481510dc93150662944f6da399292c5e264d325b))
* **messaging:** introduce provider abstraction for SMS and WhatsApp ([4781c07](https://github.com/EagleFox31/atelier2026/commit/4781c07801377768c4d99274d3971d28bcd59f04)), closes [#18](https://github.com/EagleFox31/atelier2026/issues/18)
* **signup:** send a branded welcome email after workspace creation ([6875938](https://github.com/EagleFox31/atelier2026/commit/68759382dd5f9978a7027109f0938352b7b7c4e6))
* **signup:** send a branded welcome email after workspace creation ([408d77e](https://github.com/EagleFox31/atelier2026/commit/408d77eb9d397924157f8ebc7fa1fc9f844f3c66))
* **subscription:** add hosted checkout UI ([93e31c3](https://github.com/EagleFox31/atelier2026/commit/93e31c37f7fa616ddbde89f7f07c529c916ceab2))
* **subscription:** add hosted checkout UI ([338362b](https://github.com/EagleFox31/atelier2026/commit/338362b7c91c1f9c2af39ce015e9ffdfd0768de2))
* **subscription:** add NotchPay payment foundation ([023dd0f](https://github.com/EagleFox31/atelier2026/commit/023dd0ff614a73b32b305d2e77f5a9b096f2b674))
* **subscription:** add NotchPay payment foundation ([001823e](https://github.com/EagleFox31/atelier2026/commit/001823e684cc792c404de21d58f09e4d1e667a69))
* **subscription:** compute status in memory and expose plan features ([467aac4](https://github.com/EagleFox31/atelier2026/commit/467aac4ef67fa305aef6c78f937475b3891a9b05))
* **subscription:** compute status in memory and expose plan features ([161d622](https://github.com/EagleFox31/atelier2026/commit/161d6220898514b4c084958714715782e3fc32c0))
* **subscription:** support separate NotchPay environments ([96783a1](https://github.com/EagleFox31/atelier2026/commit/96783a14f77d9b8a7501a22d24ff1bf076e7af41))
* **team:** invitation activation page and team invitation UI ([b985b3b](https://github.com/EagleFox31/atelier2026/commit/b985b3b872be7682d9f5960fad6465fb046a47e5))
* **team:** secure employee invitations by email ([5954fa8](https://github.com/EagleFox31/atelier2026/commit/5954fa8a6c9937ca670725ea4eacebd969303743))
* **team:** send secure employee invitations by email ([0423cc0](https://github.com/EagleFox31/atelier2026/commit/0423cc05348c92190316e5950cf78d506e34ea7c))


### Bug Fixes

* **admin:** keep individually suspended users suspended on tenant reactivation ([6b36d1e](https://github.com/EagleFox31/atelier2026/commit/6b36d1ead205e0864cd0e9982b2638d8c2eeb6d1))
* **admin:** keep individually suspended users suspended on tenant reactivation ([5d49af8](https://github.com/EagleFox31/atelier2026/commit/5d49af89bc063ac32c3ad374e976639603abf05f))
* **api:** keep business errorCode in HTTP error responses ([b9db803](https://github.com/EagleFox31/atelier2026/commit/b9db80383b464c3c0e92cb1a037987c718e7b89b))
* **logs:** ne plus journaliser query string ni arguments Prisma ([8fbe53d](https://github.com/EagleFox31/atelier2026/commit/8fbe53d81f20c6d9ebc9cc2e8a290e17dc3608f3))
* **messaging:** table d'opérateurs camerounais vérifiée ([a5f673e](https://github.com/EagleFox31/atelier2026/commit/a5f673ece191485558ecc7fede8d2218d42bca1e))
* **onboarding:** skip hidden tour targets ([f4adcea](https://github.com/EagleFox31/atelier2026/commit/f4adcea464e99549a372323ba918ae3ef0631468))
* **pwa:** harden stale while revalidate caching ([b3eb59b](https://github.com/EagleFox31/atelier2026/commit/b3eb59b73acfc2cd91d760fec5cc92019bb50b46))
* **security:** add report-only Content-Security-Policy to the web app ([96f39f6](https://github.com/EagleFox31/atelier2026/commit/96f39f62e910912ea4235670658b0637920d5294))
* **security:** enable Helmet CSP on the API ([794de61](https://github.com/EagleFox31/atelier2026/commit/794de6189d9e397b6253097554f52b16ff228a5f))
* **security:** enforce rate limiting across the API (login brute force) ([5a77700](https://github.com/EagleFox31/atelier2026/commit/5a7770058746582596a5d81284be623ddeda89fc))
* **security:** enforce rate limiting across the API (login brute force) ([10b5841](https://github.com/EagleFox31/atelier2026/commit/10b5841f7ce938311ec74cb27f47e6803c8412c4))
* **security:** no clear-text passwords, strong temporary passwords, forced change ([94048d6](https://github.com/EagleFox31/atelier2026/commit/94048d65dde949790557da486fd6d0e4bd1a195c))
* **security:** stop storing passwords in clear text and force changing temporary ones ([96610de](https://github.com/EagleFox31/atelier2026/commit/96610de256469d46f2b5d15c262672a96ef81b4b))
* **settings:** explain active SMS entitlement ([4d9f59e](https://github.com/EagleFox31/atelier2026/commit/4d9f59ebef96960062464fede428351957096883))
* **settings:** tailor SMS lock guidance by status ([e94df13](https://github.com/EagleFox31/atelier2026/commit/e94df13aca34185b4b3d536cf8a87058c8af5dc7))
* **signup:** recover cleanly after lost final response ([7776480](https://github.com/EagleFox31/atelier2026/commit/7776480a70afa3a1e2a91abb7777289185e13a14))
* **sms:** enforce the SMS entitlement end to end (lot 0 + 2B) ([269c41c](https://github.com/EagleFox31/atelier2026/commit/269c41c2e0b4ccf418b1c825ea236e3936ad4908))
* **sms:** enforce the SMS entitlement end to end and mark reminders only after delivery ([a7897d1](https://github.com/EagleFox31/atelier2026/commit/a7897d16bb6b4e268d9fbc84a77f95903afec819))
* **sms:** relances bornées et jobId déterministe pour tous les SMS ([5875dd9](https://github.com/EagleFox31/atelier2026/commit/5875dd966c301e14a9236c6a0fd5479b50c7ad2b))
* **sms:** verified operator prefixes, bounded retries, no phone numbers in logs ([8320b97](https://github.com/EagleFox31/atelier2026/commit/8320b97875f53ba2ec3a56e2fcd34fbdd101963c))
* **stock:** process low-stock alerts and compare Decimal quantities correctly ([eede964](https://github.com/EagleFox31/atelier2026/commit/eede964b8ffc6c96c06c77da5c894141ac7c0ae1))
* **stock:** process low-stock alerts and compare Decimal quantities correctly ([19edd32](https://github.com/EagleFox31/atelier2026/commit/19edd32562ecbb90aa0756e7e0f785a2f106567e))
* **subscription:** lock tenant row when applying a confirmed payment ([fc24447](https://github.com/EagleFox31/atelier2026/commit/fc24447cfb1137ff7ed4ed50a997d07dfed48145))
* **subscription:** lock tenant row when applying a confirmed payment ([391d554](https://github.com/EagleFox31/atelier2026/commit/391d55457b1016d5abdfa61fd91b0062ff6d268b))
* **subscription:** map NotchPay transaction id and merchant reference correctly ([7134b43](https://github.com/EagleFox31/atelier2026/commit/7134b43dd01e9a88865bb42dcf2ebe268fc21240))
* **subscription:** map NotchPay transaction id and merchant reference correctly ([2035147](https://github.com/EagleFox31/atelier2026/commit/2035147c754e8b5c3094e84ac27af472eea0cb9f))
* **subscription:** use an existing payment return route ([4dc4e06](https://github.com/EagleFox31/atelier2026/commit/4dc4e06184196972b68c6e0c95e025a4f9f3934b))
* **ux:** link login labels, clarify locked logo after pilot, one-row settings tabs ([559404d](https://github.com/EagleFox31/atelier2026/commit/559404da51275c09da6e5abc1a27104305530710))
* **ux:** link login labels, clarify locked logo after pilot, one-row settings tabs ([5e4714e](https://github.com/EagleFox31/atelier2026/commit/5e4714e289df5550bcacca407a1a623be4555db7))
* **ux:** restore clear pilot and audit labels ([bf21d83](https://github.com/EagleFox31/atelier2026/commit/bf21d83ba3d1f4d6457dc5abd247196bf8605881))
* **workshop:** keep New OT open on inline customer creation + UX guardrails on PRs (lot 0B) ([1f5a280](https://github.com/EagleFox31/atelier2026/commit/1f5a280358e5cd54634b2093c28b1fa4e55ba0b2))
* **workshop:** keep the New OT dialog open when creating a customer inline ([18fb122](https://github.com/EagleFox31/atelier2026/commit/18fb122afa59692b699c9ec8dfffeabde9b9946f))

## [1.9.0](https://github.com/EagleFox31/atelier2026/compare/v1.8.1...v1.9.0) (2026-10-01)


### Features

* **deploy:** keep users informed and safe during deployments ([87845e0](https://github.com/EagleFox31/atelier2026/commit/87845e0067bed022588009a8406f23414b84818d))
* **deploy:** keep users informed and safe during deployments ([4a4afd7](https://github.com/EagleFox31/atelier2026/commit/4a4afd79d85871827c681d3c39f08587e6c21c4b))
* plan-aware demos and 30-day trial lifecycle ([58eb57b](https://github.com/EagleFox31/atelier2026/commit/58eb57b92ee1e5e5768db3274f90b549ff5fc61f))
* **pricing:** add three plans and billing toggle ([7271e81](https://github.com/EagleFox31/atelier2026/commit/7271e81f9ceb5c10df8de4b8bf179b91db53ffed))
* publish Atelier Maître pricing ([20aed95](https://github.com/EagleFox31/atelier2026/commit/20aed956d5245fb48f99de19011ecc9d3ef4d9cd))


### Bug Fixes

* **ci:** avoid stale release tags blocking AWS deploy ([bc83665](https://github.com/EagleFox31/atelier2026/commit/bc83665ddc58ef25fe6d4a24e3e93f04de9990a9))
* **ci:** detect deploy changes on merge commits ([fc7735c](https://github.com/EagleFox31/atelier2026/commit/fc7735c3f459da89b5a2339bd82e2b503f077f09))
* **ci:** detect deploy changes on merge commits ([8789133](https://github.com/EagleFox31/atelier2026/commit/87891330c5739e7507602675fac9de00e53cb7e6))
* **ci:** repair release tag detection shell syntax ([ccac72e](https://github.com/EagleFox31/atelier2026/commit/ccac72e46de29414ceec8f2376f7a641000dd2dc))
* clarify pricing CTAs ([0eea2c0](https://github.com/EagleFox31/atelier2026/commit/0eea2c072d65ae410008c061b714b53b435c2c35))
* **signup:** associate form labels with their inputs ([7ba0f86](https://github.com/EagleFox31/atelier2026/commit/7ba0f869d1e77f4ed10d180bc527264d10505361))
* **signup:** associate form labels with their inputs ([09987c9](https://github.com/EagleFox31/atelier2026/commit/09987c941ed3ea823d9c663eca54c79f3e4a8087))
* tighten trial onboarding UX and QA coverage ([a61fb06](https://github.com/EagleFox31/atelier2026/commit/a61fb06614c2430a6317626e05c3d4628e356de7))
* **vehicles:** label year field as "Année de fabrication" ([dae3ba2](https://github.com/EagleFox31/atelier2026/commit/dae3ba2144f59173b89de92a9cea6347edf0e5ff))
