import {collectUsage} from '../../../usage.mjs';
import {collectAccountQuota} from '../../../account-quota.mjs';
const [local,account]=await Promise.all([collectUsage(),collectAccountQuota().catch(()=>null)]);
console.log(JSON.stringify({date:local.date,todayTokens:local.total,quota:account||local.quota||null,cashBalance:null,source:account?'account/rateLimits/read':'local-token-events'},null,2));
