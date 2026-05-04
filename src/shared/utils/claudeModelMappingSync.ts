type DefaultModel = {
  alias: string;
  envKey: string;
  id?: string;
};

type ExistingEnv = Record<string, string | undefined>;

type GetHydratedModelMappingsParams = {
  defaultModels: DefaultModel[];
  currentMappings: Record<string, string>;
  existingEnv: ExistingEnv;
  hasHydrated: boolean;
};

export const getHydratedModelMappings = ({
  defaultModels,
  currentMappings,
  existingEnv,
  hasHydrated,
}: GetHydratedModelMappingsParams): Record<string, string> => {
  if (hasHydrated) return {};

  const updates: Record<string, string> = {};

  defaultModels.forEach((model) => {
    const existingValue = existingEnv[model.envKey];
    if (existingValue && currentMappings[model.alias] !== existingValue) {
      updates[model.alias] = existingValue;
      return;
    }

    if (!existingValue && model.id && !currentMappings[model.alias]) {
      updates[model.alias] = model.id;
    }
  });

  return updates;
};
