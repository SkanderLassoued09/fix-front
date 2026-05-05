import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ProfileService } from '../../service/profile.service';

export const authGuard: CanActivateFn = () => {
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
