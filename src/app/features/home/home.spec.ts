/*
 * Pruebas unitarias
 * Prueba HomeComponent
 */

import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HomeComponent } from './home'; 
import { SportDbService } from '../../services/sportdb.service';
import { of } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

describe('HomeComponent', () => {
  let component: HomeComponent;
  let fixture: ComponentFixture<HomeComponent>;

  const sportServiceMock = {
    getLiveMatches: () => of([]), 
    getStandings: () => of([])    
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HomeComponent],

      providers: [
        { provide: SportDbService, useValue: sportServiceMock },
        { provide: ActivatedRoute, useValue: {} }
      ]
    })
      .compileComponents();

    fixture = TestBed.createComponent(HomeComponent);
    component = fixture.componentInstance;
    fixture.detectChanges(); 
  });

  it('should create the component', () => {
    expect(component).toBeTruthy();
  });

  it('should have loading initially set to false after data load', () => {
    expect(component.loading).toBeFalsy();
  });
});
