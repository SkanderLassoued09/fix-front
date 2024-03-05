import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';

@Injectable({
    providedIn: 'root',
})
export class ClientService {
    constructor() {}

    addClient(clientInfo) {
        return gql`
        mutation {
            createClient(
                createClientInput: {
                    first_name: "${clientInfo.first_name}"
                    last_name: "${clientInfo.lastName}"
                    region: "${clientInfo.region}"
                    address: "${clientInfo.address}"
                    email: "${clientInfo.email}"
                    phone: "${clientInfo.phone}"
                }
            ) {
                _id
            }
        }
    `;
    }

    getAllClient() {
        return gql`
            {
                findAllClient {
                    _id
                    first_name
                    last_name
                    region
                    address
                    email
                    phone
                }
            }
        `;
    }
}
