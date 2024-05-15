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
                     user{_id role email username}
                }
            }
        `;
    }

    addProfile(profileInfo) {
        return gql`
            mutation {
                createProfile(
                    createProfileInput: {
                        username: "${profileInfo.username}"
                        firstName: "${profileInfo.firstName}"
                        lastName: "${profileInfo.lastName}"
                        phone: "${profileInfo.phone}"
                        email: "${profileInfo.email}"
                        role: "${profileInfo.role}"
                        password: "${profileInfo.password}"
                    }
                ) {
                    _id
                }
            }
        `;
    }

    getAllProfile(rows, first) {
        return gql`
            {
                getAllProfiles(paginationConfig: { rows: ${rows}, first: ${first} }) {
                    profileRecord {
                        _id
                        username
                        firstName
                        lastName
                        phone
                        role
                        email
                        createdAt
                        updatedAt
                    }
                    totalProfileCount
                }
            }
        `;
    }

    notificationDiagnostic() {
        return gql`
            subscription {
                notificationDiagnostic {
                    _idDi
                    messageNotification
                    id_tech_diag
                }
            }
        `;
    }
    notificationrep() {
        return gql`
            subscription {
                notificationReparation {
                    _idDi
                    messageNotification
                    id_tech_diag
                }
            }
        `;
    }
}
