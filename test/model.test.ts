import { describe, it, expect, beforeEach } from 'vitest';
import { IsEmail, IsInt, IsString, Min } from 'class-validator';
import { Exclude, Expose, Model, Readonly, Type } from '../src';

class Post extends Model {
    @IsString()
    title = '';

    @IsString()
    createdAt = new Date().toISOString();
}

class Profile extends Model {
    @IsString()
    bio = '';

    @IsString()
    website = '';
}

class User extends Model {
    @IsInt()
    @Min(0)
    id = 0;

    @IsString()
    firstName = '';

    @IsString()
    lastName = '';

    @IsEmail()
    email = '';

    @Exclude()
    password = '';

    @Expose({ groups: ['admin'] })
    isAdmin = false;

    @Readonly()
    createdAt = new Date().toISOString();

    @Type(Profile)
    profile = new Profile();

    @Type(Post)
    posts: Post[] = [];
}

describe('Advanced Model Tests', () => {
    let user: User;

    beforeEach(() => {
        user = User.fromJson({
            id: 0,
            first_name: 'Pavel',
            last_name: 'del Pozo',
            email: 'pavel@dev.com',
            password: 'secret',
            is_admin: true,
            created_at: '2024-01-01',
            profile: {
                bio: 'Frontend Dev',
                website: 'https://pavel.dev',
            },
            posts: [
                { title: 'Hola', created_at: '2023-01-01' },
                { title: 'Adiós', created_at: '2023-02-01' },
            ],
        } as unknown as Partial<User>);
    });

    it('should map snake_case to camelCase', () => {
        expect(user.firstName).toBe('Pavel');
        expect(user.lastName).toBe('del Pozo');
        expect(user.profile.bio).toBe('Frontend Dev');
        expect(user.posts.length).toBe(2);
        expect(user.posts[0].title).toBe('Hola');
    });

    it('should apply class transformations and types', () => {
        expect(user.profile).toBeInstanceOf(Profile);
        expect(user.posts[0]).toBeInstanceOf(Post);
    });

    it('should exclude password from toJson()', () => {
        const json = user.toJson();
        expect('password' in json).toBe(false);
    });

    it('should only export fields with matching @Expose group', () => {
        const json = user.toJson({ group: 'admin' });
        expect(json.is_admin).toBe(true);
        const json2 = user.toJson({ group: 'user' });
        expect('is_admin' in json2).toBe(false);
    });

    it('should ignore readonly fields during applyJson', () => {
        const before = user.createdAt;
        user.applyJson({ created_at: '2025-01-01' });
        expect(user.createdAt).toBe(before);
    });

    it('should return only changed fields with onlyChanged option', () => {
        user.lastName = 'Nuevo';
        const json = user.toJson({ onlyChanged: true });
        expect(json).toHaveProperty('last_name', 'Nuevo');
        expect(json).not.toHaveProperty('first_name');
    });

    it('should clone correctly', () => {
        const clone = user.clone();
        expect(clone).not.toBe(user);
        expect(clone.toJson()).toEqual(user.toJson());
    });

    it('should detect is equal', () => {
        const clone = user.clone();
        expect(user.isEqual(clone)).toBe(true);
        user.lastName = 'Otro';
        expect(user.isEqual(clone)).toBe(false);
    })

    it('should detect diffs and equality', () => {
        const clone = user.clone();
        expect(user.isEqual(clone)).toBe(true);
        user.lastName = 'Otro';
        expect(user.isEqual(clone)).toBe(false);
    });

    it('should reset changes', () => {
        user.lastName = 'Otro';
        user.reset();
        expect(user.lastName).toBe('del Pozo');
    });

    it('should freeze model', () => {
        user.freeze();
        expect(Object.isFrozen(user)).toBe(true);
    });

    it('should merge partial objects', () => {
        user.merge({ firstName: 'Otro' });
        expect(user.firstName).toBe('Otro');
    });

    it('should create FormData', () => {
        const form = user.toFormData();
        expect(form.get('first_name')).toBe('Pavel');
        expect(form.get('email')).toBe('pavel@dev.com');
    });

    it('should validate correctly', () => {
        expect(user.isValid()).toBe(true);
    });
});
