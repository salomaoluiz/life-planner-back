export abstract class UseCase<Output> {
  abstract execute(): Promise<Output>;
}
export abstract class UseCaseWithParams<Input, Output> {
  abstract execute(params: Input): Promise<Output>;
}
