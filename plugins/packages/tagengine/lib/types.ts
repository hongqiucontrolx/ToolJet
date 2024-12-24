export type SourceOptions = {
  url: string;
};

export type QueryOptions = {
  operation: Operation;
  tag_ids?: string;
  tag_id?: string;
  tag_value?: string | number | boolean;
  value_type?: string;
};

export enum Operation {
  GetValue = 'get_value',
  SetValue = 'set_value',
  Sub = 'sub',
}
