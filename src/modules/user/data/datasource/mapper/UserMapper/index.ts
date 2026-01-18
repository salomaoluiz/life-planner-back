import { User } from '@db/client';
import UserEntity from '@user/domain/entity/UserEntity';

export class UserMapper {
  static toDomain(raw: User): UserEntity {
    return new UserEntity({
      email: raw.email,
      id: raw.id,
      name: raw.name,
      passwordHash: raw.password_hash,
      // Optional fields
      photoUrl: raw.photo_url ?? undefined,
    });
  }

  static toPersistence(raw: UserEntity): User {
    return {
      email: raw.email,
      id: raw.id,
      name: raw.name,
      password_hash: raw.passwordHash ?? '',
      // Optional fields
      created_at: null,
      photo_url: raw.photoUrl ?? null,
      updated_at: null,
    };
  }
}
