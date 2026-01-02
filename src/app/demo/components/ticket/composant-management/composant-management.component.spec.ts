import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComposantManagementComponent } from './composant-management.component';

describe('ComposantManagementComponent', () => {
  let component: ComposantManagementComponent;
  let fixture: ComponentFixture<ComposantManagementComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComposantManagementComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ComposantManagementComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
