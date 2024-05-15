import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TechDiListComponent } from './tech-di-list.component';

describe('TechDiListComponent', () => {
  let component: TechDiListComponent;
  let fixture: ComponentFixture<TechDiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TechDiListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TechDiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
