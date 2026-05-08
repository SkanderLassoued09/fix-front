import { HttpClientModule } from '@angular/common/http';
import { ApolloModule, APOLLO_OPTIONS, APOLLO_FLAGS } from 'apollo-angular';
import { HttpLink } from 'apollo-angular/http';
import { InMemoryCache, ApolloLink, split } from '@apollo/client/core';
import { setContext } from '@apollo/client/link/context';

import { Observable, getMainDefinition } from '@apollo/client/utilities';
import { NgModule } from '@angular/core';
import { environment } from 'src/environments/environment';

const uri = `${environment.apiUrl}graphql`; //changed apiUrl

export function createApollo(httpLink: HttpLink) {
    const basic = setContext(() => ({
        headers: {
            Accept: ['charset=utf-8', 'application/json'],
        },
    }));

    const auth = setContext(() => {
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

    const customWsLink = new ApolloLink((operation) => {
        return new Observable((observer) => {
            const context = operation.getContext();
            const { clientAwareness } = context;

            const wsUrl = environment.apiUrl
                .replace('http://', 'ws://')
                .replace('https://', 'wss://');

            const ws = new WebSocket(`${wsUrl}graphql`, 'graphql-ws');

            ws.addEventListener('open', () => {
                console.log('GraphQL WS connected');

                ws.send(
                    JSON.stringify({
                        type: 'connection_init',
                        payload: clientAwareness || {},
                    }),
                );

                ws.send(
                    JSON.stringify({
                        id: '1',
                        type: 'start',
                        payload: {
                            variables: operation.variables,
                            extensions: operation.extensions,
                            operationName: operation.operationName,
                            query: operation.query.loc?.source.body,
                        },
                    }),
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

            ws.addEventListener('error', (error) => {
                console.error('GraphQL WS error', error);
            });

            ws.addEventListener('close', () => {
                console.warn('GraphQL WS disconnected');
            });

            return () => {
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
