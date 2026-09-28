// Configura credenciales de pago/POS para un tenant desde la terminal — no
// hay pantalla de settings todavía (Pagos/Envíos/Fudo quedó en el backlog
// del plan, sección 8), así que esto es lo que hace falta para que Juan
// pueda usar la integración real de MP/Fudo una vez que tenga las claves.
//
// Uso:
//   npm run set:payment-config -- pizzazeka --mp-token=APP_USR-xxx
//   npm run set:payment-config -- pizzazeka --fudo-token=xxx --fudo-business-id=yyy --fudo-enabled
import { PrismaClient } from '@prisma/client';
import { encryptSecret } from '../src/lib/crypto';

const prisma = new PrismaClient();

function getFlag(args: string[], name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = args.find((a) => a.startsWith(prefix));
  return match?.slice(prefix.length);
}
function hasFlag(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

async function main() {
  const [tenantSlug, ...flags] = process.argv.slice(2);
  if (!tenantSlug) {
    console.error(
      'Uso: npm run set:payment-config -- <tenantSlug> [--mp-token=...] [--payment-alias=...] [--payment-cvu=...] [--payment-titular=...] [--fudo-token=...] [--fudo-business-id=...] [--fudo-enabled]'
    );
    process.exit(1);
  }

  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error(`Tenant "${tenantSlug}" no existe.`);

  const mpToken = getFlag(flags, 'mp-token');
  const paymentAlias = getFlag(flags, 'payment-alias');
  const paymentCvu = getFlag(flags, 'payment-cvu');
  const paymentTitular = getFlag(flags, 'payment-titular');

  if (mpToken || paymentAlias || paymentCvu || paymentTitular) {
    await prisma.paymentConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        ...(mpToken ? { mpAccessTokenEncrypted: encryptSecret(mpToken), mpEnabled: true } : {}),
        ...(paymentAlias ? { paymentAlias } : {}),
        ...(paymentCvu ? { paymentCvu } : {}),
        ...(paymentTitular ? { paymentTitular } : {}),
      },
      create: {
        tenantId: tenant.id,
        mpAccessTokenEncrypted: mpToken ? encryptSecret(mpToken) : null,
        mpEnabled: !!mpToken,
        paymentAlias,
        paymentCvu,
        paymentTitular,
      },
    });
    console.log('PaymentConfig actualizado.' + (mpToken ? ' Mercado Pago habilitado.' : ''));
  }

  const fudoToken = getFlag(flags, 'fudo-token');
  const fudoBusinessId = getFlag(flags, 'fudo-business-id');
  const fudoEnabled = hasFlag(flags, 'fudo-enabled');

  if (fudoToken || fudoBusinessId || fudoEnabled) {
    await prisma.pOSIntegrationConfig.upsert({
      where: { tenantId: tenant.id },
      update: {
        ...(fudoToken ? { apiTokenEncrypted: encryptSecret(fudoToken) } : {}),
        ...(fudoBusinessId ? { businessId: fudoBusinessId } : {}),
        ...(fudoEnabled ? { enabled: true } : {}),
      },
      create: {
        tenantId: tenant.id,
        provider: 'fudo',
        apiTokenEncrypted: fudoToken ? encryptSecret(fudoToken) : null,
        businessId: fudoBusinessId,
        enabled: fudoEnabled,
      },
    });
    console.log('POSIntegrationConfig (Fudo) actualizado.' + (fudoEnabled ? ' Fudo habilitado.' : ''));
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
