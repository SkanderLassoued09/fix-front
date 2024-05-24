import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ProfileListComponent } from './ProfileListComponent';

describe('ProfileListComponent', () => {
    let component: ProfileListComponent;
    let fixture: ComponentFixture<ProfileListComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ProfileListComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(ProfileListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });
});
