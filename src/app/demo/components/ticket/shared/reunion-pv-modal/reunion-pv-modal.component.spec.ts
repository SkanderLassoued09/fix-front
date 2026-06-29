import { ComponentFixture, TestBed } from '@angular/core/testing';
import { NoopAnimationsModule } from '@angular/platform-browser/animations';
import { Apollo } from 'apollo-angular';
import { of, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';

import { ReunionPvModalComponent } from './reunion-pv-modal.component';
import { ProfileService } from 'src/app/demo/service/profile.service';
import { ReunionPvService } from 'src/app/demo/service/reunion-pv.service';
import { MutationRunner } from 'src/app/demo/service/mutation-runner.service';

/**
 * Focused on the bug this change fixes: the participant selector must be
 * populated from ALL profiles returned by the `getAllProfiles` query, and
 * each selected participant must carry its own attendance status.
 */
describe('ReunionPvModalComponent — participants', () => {
    let fixture: ComponentFixture<ReunionPvModalComponent>;
    let component: ReunionPvModalComponent;

    const MOCK_PROFILES = [
        {
            _id: 'p1',
            firstName: 'Skander',
            lastName: 'Lassoued',
            username: 'skander',
            role: 'ADMIN_MANAGER',
        },
        // no first/last name → label should fall back to username
        { _id: 'p2', firstName: '', lastName: '', username: 'nezih', role: 'TECH' },
    ];

    function setup(apolloQuery: () => unknown) {
        TestBed.configureTestingModule({
            imports: [ReunionPvModalComponent, NoopAnimationsModule],
            providers: [
                { provide: Apollo, useValue: { query: apolloQuery } },
                { provide: ProfileService, useValue: { getAllProfile: () => ({}) } },
                { provide: ReunionPvService, useValue: { createReunionPV: () => ({}) } },
                { provide: MutationRunner, useValue: { run: () => Promise.resolve({}) } },
                MessageService,
            ],
        });
        fixture = TestBed.createComponent(ReunionPvModalComponent);
        component = fixture.componentInstance;
        fixture.detectChanges(); // ngOnInit → loadProfiles()
    }

    afterEach(() => TestBed.resetTestingModule());

    it('populates the MultiSelect options from every profile in the DB', () => {
        setup(() =>
            of({ data: { getAllProfiles: { profileRecord: MOCK_PROFILES } } }),
        );

        expect(component.profiles.length).toBe(2);
        expect(component.profiles[0]).toEqual(
            jasmine.objectContaining({ _id: 'p1', label: 'Skander Lassoued' }),
        );
        // fallback to username when no first/last name
        expect(component.profiles[1].label).toBe('nezih');
        expect(component.profilesLoading).toBeFalse();
        expect(component.profilesError).toBeFalse();
    });

    it('defaults a newly-selected participant to PRESENT and allows EXCUSE/ABSENT', () => {
        setup(() =>
            of({ data: { getAllProfiles: { profileRecord: MOCK_PROFILES } } }),
        );

        component.form.get('participants')?.setValue(['p1']);
        component.onParticipantsChange(['p1']);
        expect(component.participantStatut('p1')).toBe('PRESENT');

        component.setParticipantStatut('p1', 'EXCUSE');
        expect(component.participantStatut('p1')).toBe('EXCUSE');

        // de-selecting drops its status from the map
        component.removeParticipant('p1');
        expect(component.selectedParticipants).toEqual([]);
        expect(component.participantStatut('p1')).toBe('PRESENT'); // back to default
    });

    it('flags an error (and stays usable) when the profiles query fails', () => {
        setup(() => throwError(() => new Error('network down')));

        expect(component.profilesError).toBeTrue();
        expect(component.profilesLoading).toBeFalse();
        // form is still built / usable despite the failure
        expect(component.form).toBeTruthy();
    });
});
