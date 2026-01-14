import { CriError } from "../errors/cri-error";
import { OtgConfig } from "../hmrc-apis/types/otg";
import { PdvConfig } from "../hmrc-apis/types/pdv";
import { getParametersValues } from "../util/get-parameters";

export type HmrcApiConfig = {
  otg: OtgConfig;
  pdv: PdvConfig;
};

const cacheTtlInSeconds = Number(process.env.POWERTOOLS_PARAMETERS_MAX_AGE) || 300;

export async function getHmrcConfig(clientId: string): Promise<HmrcApiConfig> {
  const otgParamName = `/check-hmrc-cri-api/OtgUrl/${clientId}`;
  const pdvParamName = `/check-hmrc-cri-api/NinoCheckUrl/${clientId}`;
  const paramPaths = [otgParamName, pdvParamName];

  try {
    const ssmParams = await getParametersValues(paramPaths, cacheTtlInSeconds);

    return {
      otg: {
        apiUrl: ssmParams[otgParamName],
      },
      pdv: {
        apiUrl: ssmParams[pdvParamName],
      },
    };
  } catch (err) {
    throw new CriError(500, `Failed to load HMRC config: ${(err as Error).message}`);
  }
}
