export enum RecipeParameterKind {
  SINGULAR = 'singular',
  PLUS = 'plus',
}

export interface RecipeParameter {
  name: string;
  kind: RecipeParameterKind;
  default: string;
  [key: string]: unknown;
}

export interface RecipeResponse {
  name: string;
  doc: string;
  parameters: RecipeParameter[];
  attributes: (Record<string, string> | string)[];
  private: boolean;
  [key: string]: unknown;
}

export interface RecipeParsed {
  name: string;
  doc: string;
  parameters: Pick<RecipeParameter, 'name' | 'kind' | 'default'>[];
  groups: string[];
}
