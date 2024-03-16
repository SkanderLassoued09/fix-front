import { Component } from '@angular/core';
import { FormControl, FormGroup } from '@angular/forms';
import { Router } from '@angular/router';
import { Apollo } from 'apollo-angular';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { LayoutService } from 'src/app/layout/service/app.layout.service';

@Component({
    selector: 'app-login',
    templateUrl: './login.component.html',
    styles: [
        `
            :host ::ng-deep .pi-eye,
            :host ::ng-deep .pi-eye-slash {
                transform: scale(1.6);
                margin-right: 1rem;
                color: var(--primary-color) !important;
            }
        `,
    ],
})
export class LoginComponent {
    loginForm = new FormGroup({
        username: new FormControl(),
        password: new FormControl(),
    });
    valCheck: string[] = ['remember'];

    password!: string;

    constructor(
        private profileService: ProfileService,
        private apollo: Apollo,
        private router: Router,
        public layoutService: LayoutService
    ) {}

    login() {
        const { username, password } = this.loginForm.value;
        this.apollo
            .query<any>({
                query: this.profileService.getTokenLogin(username, password),
            })
            .subscribe(({ data }) => {
                if (data.login.access_token) {
                    localStorage.setItem('token', data.login.access_token);
                    localStorage.setItem('_id', data.login.user._id);
                    localStorage.setItem('role', data.login.user.role);
                    localStorage.setItem('username', data.login.user.username);

                    this.router.navigateByUrl('/');
                }
            });
    }
}
