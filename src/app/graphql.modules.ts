import { HttpClientModule } from '@angular/common/http';
import { ApolloModule, APOLLO_OPTIONS, APOLLO_FLAGS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink, split } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';

import { Observable, getMainDefinition } from '@apollo/client/utilities';
// import { URL } from "./URLs";
import { NgModule } from '@angular/core';

const uri = 'http://localhost:3000/graphql';

export function createApollo(httpLink: HttpLink) {
    const basic = setContext((operation, context) => ({
        headers: {
            Accept: ['charset=utf-8', 'application/json'],
        },
    }));

    const auth = setContext((operation, context) => {
        const token = localStorage.getItem('token');

        if (token === null) {
            return {};
        } else {
            return {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            };
        }
    });

    const httpLinkWithAuth = ApolloLink.from([
        basic,
        auth,
        httpLink.create({ uri }),
    ]);

    const customWsLink = new ApolloLink((operation, forward) => {
        return new Observable((observer) => {
            const context = operation.getContext();
            const { clientAwareness } = context;

            const ws = new WebSocket(
                `ws://localhost:3000/graphql`,
                'graphql-ws'
            );

            ws.addEventListener('open', (event) => {
                // Send the GQL_START message
                ws.send(
                    JSON.stringify({
                        type: 'connection_init',
                        payload: clientAwareness || {},
                    })
                );

                // Send the GQL_START message
                ws.send(
                    JSON.stringify({
                        id: '1', // You can use a unique identifier here
                        type: 'start',
                        payload: {
                            variables: operation.variables,
                            extensions: operation.extensions,
                            operationName: operation.operationName,
                            query: operation.query,
                        },
                    })
                );
            });

            ws.addEventListener('message', (event) => {
                const message = JSON.parse(event.data);

                if (message.type === 'data') {
                    observer.next(message.payload);
                }

                if (message.type === 'complete') {
                    observer.complete();
                }

                if (message.type === 'error') {
                    observer.error(message.payload);
                }
            });

            return () => {
                // Cleanup logic when the Observable is unsubscribed
                ws.close();
            };
        });
    });

    const link = split(
        ({ query }) => {
            const definition = getMainDefinition(query);
            return (
                definition.kind === 'OperationDefinition' &&
                definition.operation === 'subscription'
            );
        },
        customWsLink,
        httpLinkWithAuth
    );

    const cache = new InMemoryCache();

    return {
        link,
        cache,
        defaultOptions: {
            watchQuery: {
                fetchPolicy: 'no-cache',
                errorPolicy: 'ignore',
            },
            query: {
                fetchPolicy: 'no-cache',
                errorPolicy: 'all',
            },
        },
    };
}

@NgModule({
    imports: [ApolloModule, HttpClientModule],
    providers: [
        {
            provide: APOLLO_FLAGS,
            useValue: {
                useMutationLoading: true,
            },
        },
        {
            provide: APOLLO_OPTIONS,
            useFactory: createApollo,
            deps: [HttpLink],
        },
    ],
})
export class GraphQlModule {}
