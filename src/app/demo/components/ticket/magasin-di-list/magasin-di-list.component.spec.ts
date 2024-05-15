import { ComponentFixture, TestBed } from '@angular/core/testing';

import { MagasinDiListComponent } from './magasin-di-list.component';

describe('MagasinDiListComponent', () => {
  let component: MagasinDiListComponent;
  let fixture: ComponentFixture<MagasinDiListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MagasinDiListComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(MagasinDiListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
