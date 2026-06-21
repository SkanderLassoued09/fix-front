import { Injectable } from '@angular/core';
import { gql } from 'apollo-angular';
import { gqlStr } from './gql-escape.util';

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
                    first_name: ${JSON.stringify(clientInfo.first_name ?? '')}
                    last_name: ${JSON.stringify(clientInfo.last_name ?? '')}
                    region: ${JSON.stringify(clientInfo.region ?? '')}
                    address: ${JSON.stringify(clientInfo.address ?? '')}
                    email: ${JSON.stringify(clientInfo.email ?? '')}
                    phone: ${JSON.stringify(clientInfo.phone ?? '')}
                }
            ) {
                _id
            }
        }
    `;
    }

    searchClient(field: string, value: string, first: number, rows: number) {
        return gql`
    {
      searchClient(
        paginationConfig: { first: ${first}, rows: ${rows} }
        search: { field: "${field}", value: "${value}" }
      ) {
        clientRecords {
          _id
          first_name
          last_name
          region
          address
          email
          phone
        }
        totalClientRecord
      }
    }
  `;
    }

    getAllClient(rows, first) {
        return gql`
            {
                findAllClient(PaginationConfig: { rows: ${rows}, first: ${first} }) {
                    clientRecords {
                        _id
                        first_name
                        last_name
                        region
                        address
                        email
                        phone
                    }
                    totalClientRecord
                }
            }
        `;
    }
    removeClient(_id: string) {
        return gql`
        mutation {
            removeClient(_id:"${_id}"){
            isDeleted}
        }
    `;
    }

    updateClient(clientData) {
        return gql`
            mutation {
                updateClient(
                    updateClientInput: {
                        _id: "${clientData._id}"
                        first_name: ${gqlStr(clientData.first_name)}
                        last_name: ${gqlStr(clientData.last_name)}
                        region: ${gqlStr(clientData.region)}
                        address: ${gqlStr(clientData.address)}
                        email: ${gqlStr(clientData.email)}
                        phone: ${gqlStr(clientData.phone)}
                    }
                ) {
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
