/*
 * Pruebas unitarias
 * Prueba MatchesComponent
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MatchesComponent } from './matches'; 
import { SportDbService } from '../../services/sportdb.service';
import { of } from 'rxjs';

describe('MatchesComponent', () => {
  let component: MatchesComponent;
  let fixture: ComponentFixture<MatchesComponent>;

  const sportServiceMock = {
    getFixtures: () => of([]) 
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MatchesComponent], 
      providers: [
        { provide: SportDbService, useValue: sportServiceMock }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(MatchesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
