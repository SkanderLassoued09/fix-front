import { inject } from '@angular/core';
import {
    CanActivateFn,
    ActivatedRouteSnapshot,
    RouterStateSnapshot,
    Router,
} from '@angular/router';
import { ProfileService } from '../../service/profile.service';

export const authGuard: CanActivateFn = (
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
) => {
    const authService = inject(ProfileService);
    const router = inject(Router);

    const isAuth = authService.checkAuth();
    if (isAuth) {
        return true;
    } else {
        router.navigate(['/auth/login']);
        localStorage.removeItem('token');
        return false;
    }
};
