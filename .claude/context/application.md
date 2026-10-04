# Application layer (`src/modules/<m>/application`)

## Use case

One class per directory: `use-case/<Name>UseCase/index.ts` (+ `index.test.ts`, `index.mocks.ts`). Named export, implements the base type from `@shared/application/use-case/types`:

- `UseCase<Output>` → `execute(): Promise<Output>`
- `UseCaseWithParams<Input, Output>` → `execute(params: Input): Promise<Output>`

```ts
export class UpdateUserUseCase implements UseCaseWithParams<UpdateUserInput, UpdateUserOutput> {
  constructor(@Inject('IUserRepository') private readonly userRepository: IUserRepository) {}

  async execute(params: UpdateUserInput): Promise<UpdateUserOutput> {
    const user = await this.userRepository.getUserById(params.id);
    if (!user) throw new NotFoundException();
    ...
  }
}
```

Rules:

- Depend on repository **interfaces** via `@Inject('I…')`; other infra via shared tokens (`'IPasswordHasher'`, `'IJwtProvider'`…).
- Business rules, existence/ownership checks and error throwing happen here, not in controllers or repositories.
- Output is a plain object with only what callers need (never `passwordHash`).
- Partial updates: distinguish "absent" from "explicitly cleared" (see `UpdateUserUseCase`: `'photoUrl' in params`).
- Not decorated with `@Injectable()` in existing code (Nest resolves via `@Inject` params); keep the existing style.

## Application DTOs (`application/dto/<UseCaseName>.ts`)

Zod schema + inferred types; independent from API DTOs (those live in `src/api/<name>/v<N>/dto`).

```ts
export const UpdateUserSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1).max(100).optional(),
});
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;
export type UpdateUserOutput = { email: string; id: string; name: string; photoUrl?: string };
```

## Registering

Add the class to the module's `useCases` array (`providers` + `exports`) — see `user.module.ts`. Then inject it in the matching `api/<name>/v<N>/<name>.service.ts`.

## Existing use cases (user module)

`LoginByEmailUseCase` (verifies hash, signs JWT `{ user: { id } }`), `SignUpByEmailUseCase`, `FindUserByIdUseCase`, `UpdateUserUseCase`.

## Family module use cases

`CreateFamilyUseCase` (validates name 1–50 trimmed), `GetUserFamiliesUseCase` (sorted), `GetFamilyByIdUseCase` (404 for non-members), `EnsureFamilyOwnerUseCase` (404 → 403), `UpdateFamilyUseCase`, `DeleteFamilyUseCase`, plus the exported cross-module contract composed only in `src/api`: `GetUserFamilyIdsUseCase.execute(userId) → string[]` and `CheckFamilyMembershipUseCase.execute({ userId, familyId }) → boolean`.
