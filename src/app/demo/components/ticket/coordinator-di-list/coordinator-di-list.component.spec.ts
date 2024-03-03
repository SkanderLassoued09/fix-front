import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CoordinatorDiListComponent } from './coordinator-di-list.component';

describe('CoordinatorDiListComponent', () => {
  let component: CoordinatorDiListComponent;
  let fixture: ComponentFixture<CoordinatorDiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CoordinatorDiListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(CoordinatorDiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
