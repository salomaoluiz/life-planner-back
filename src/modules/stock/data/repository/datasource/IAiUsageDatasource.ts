export interface IAiUsageDatasource {
  consume(
    user_id: string,
    kind: 'LIGHT' | 'SEARCH',
    day: string,
    limit: number,
  ): Promise<null | number>;
  findDay(user_id: string, day: string): Promise<{ count: number; kind: 'LIGHT' | 'SEARCH' }[]>;
}
