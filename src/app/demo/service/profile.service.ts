import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

@Injectable()
export class ProfileService {
    constructor() {}

    checkAuth(): boolean {
        const isAuth = localStorage.getItem('token');
        if (isAuth) {
            return true;
        } else {
            return false;
        }
    }

    getTokenLogin(username: string, password: string) {
        return gql`
            mutation {
                login(
                    loginAuthInput: { username: "${username}", password: "${password}" }
                ) {
                    access_token
                }
            }
        `;
    }
}
