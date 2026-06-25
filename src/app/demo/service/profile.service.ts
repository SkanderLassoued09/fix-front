import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';
import { gqlStr } from './gql-escape.util';

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
                    loginAuthInput: { username: ${gqlStr(username)}, password: ${gqlStr(password)} }
                ) {
                    access_token
                    user{_id role email username}
                }
            }
        `;
    }

    /**
     * Logout — token is sent as an explicit GraphQL arg (not via the
     * Bearer header) so the backend can decode it directly with
     * JwtService, sidestepping the @CurrentUser decorator wiring that was
     * returning undefined and leaving `isConnected:true` stuck.
     */
    logoutMutation(token: string) {
        return gql`
            mutation {
                logout(token: ${gqlStr(token)})
            }
        `;
    }

    addProfile(profileInfo) {
        return gql`
            mutation {
                createProfile(
                    createProfileInput: {
                        username: ${gqlStr(profileInfo.username)}
                        firstName: ${gqlStr(profileInfo.firstName)}
                        lastName: ${gqlStr(profileInfo.lastName)}
                        phone: ${gqlStr(profileInfo.phone)}
                        email: ${gqlStr(profileInfo.email)}
                        role: ${gqlStr(profileInfo.role)}
                        password: ${gqlStr(profileInfo.password)}
                    }
                ) {
                    _id
                }
            }
        `;
    }
    searchProfile(field: string, value: string, first: number, rows: number) {
        return gql`
    {
      searchProfile(
        paginationConfig: { first: ${first}, rows: ${rows} }
        search: { field: "${field}", value: "${value}" }
      ) {
        profileRecord {
          _id
          username
          firstName
          lastName
          phone
          email
          role
          createdAt
          updatedAt
        }
        totalProfileCount
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

    /**
     * Update profile
     */

    updateProfile(profile: any) {
        return gql`
            mutation {
                updateProfile(
                    _id: "${profile._id}"
                    updateProfileInput: {
                        firstName: ${gqlStr(profile.firstName)}
                        lastName: ${gqlStr(profile.lastName)}
                        phone: ${gqlStr(profile.phone)}
                        email: ${gqlStr(profile.email)}
                    }
                ) {
                    _id
                    firstName
                    lastName
                    email
                    phone
                }
            }
        `;
    }

    /**
     * delete profile soft delete
     */

    deleteProfile(_id: string) {
        return gql`
            mutation {
                deleteProfile(_id: "${_id}") {
                    _id
                    isDeleted
                }
            }
        `;
    }
}
